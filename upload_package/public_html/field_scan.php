<?php
/**
 * field_scan.php — ライブスキャン
 * カメラ(Gemini AI) + 音声(BirdNET) + GPS — 全部 vanilla JS
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
$currentUser = Auth::user();
if (!$currentUser) { header('Location: login.php?redirect=field_scan.php'); exit; }
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php $meta_title = "ライブスキャン | ikimon.life"; include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
    <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js" defer></script>
    <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js" defer></script>
    <script src="assets/js/BioPrescreen.js?v=17c" defer></script>
    <style>
        #scan-active { position:fixed; inset:0; z-index:50; background:#000; display:flex; flex-direction:column; }
        @keyframes scanFade { 0%{opacity:0;transform:translateX(-50%) translateY(-10px)} 10%{opacity:1;transform:translateX(-50%) translateY(0)} 80%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(-10px)} }
    </style>
</head>
<body class="bg-black text-white">

<!-- ===== 開始前 ===== -->
<div id="scan-ready" class="min-h-screen">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <div class="max-w-lg mx-auto px-4 py-8 space-y-6" style="padding-top:calc(var(--nav-height,56px) + 2rem);padding-bottom:calc(var(--bottom-nav-height,72px) + 2rem)">
        <div class="text-center">
            <div class="text-5xl mb-3">🌍</div>
            <h1 class="text-2xl font-black">ライブスキャン</h1>
            <p class="text-gray-400 mt-1 text-sm">移動しながら周囲の生き物を自動検出</p>
        </div>

        <!-- モード選択 -->
        <div class="grid grid-cols-3 gap-2" id="mode-selector">
            <button class="scan-mode-btn active" data-mode="walk" style="background:rgba(16,185,129,0.15);border:2px solid #10b981;border-radius:16px;padding:16px 8px;text-align:center">
                <div style="font-size:28px">🚶</div>
                <div style="font-size:12px;font-weight:bold;color:#10b981;margin-top:4px">徒歩</div>
                <div style="font-size:10px;color:#888;margin-top:2px">📷🎤📍</div>
            </button>
            <button class="scan-mode-btn" data-mode="bike" style="background:rgba(255,255,255,0.05);border:2px solid transparent;border-radius:16px;padding:16px 8px;text-align:center">
                <div style="font-size:28px">🚲</div>
                <div style="font-size:12px;font-weight:bold;color:#888;margin-top:4px">自転車</div>
                <div style="font-size:10px;color:#666;margin-top:2px">📷🎤📍</div>
            </button>
            <button class="scan-mode-btn" data-mode="car" style="background:rgba(255,255,255,0.05);border:2px solid transparent;border-radius:16px;padding:16px 8px;text-align:center">
                <div style="font-size:28px">🚗</div>
                <div style="font-size:12px;font-weight:bold;color:#888;margin-top:4px">車</div>
                <div style="font-size:10px;color:#666;margin-top:2px">📷📍</div>
            </button>
        </div>

        <!-- 録画・録音同意 -->
        <details id="settings-panel" open>
            <summary class="text-sm text-gray-300 cursor-pointer mb-3 flex items-center justify-between bg-white/10 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/15 transition">
                <span class="flex items-center gap-2">⚙️ 設定・確認事項</span>
                <span class="text-xs text-gray-500 transition-transform duration-200 details-arrow">▼</span>
            </summary>

        <div id="consent-banner" class="bg-amber-900/40 border border-amber-600/50 rounded-xl p-4 space-y-3">
            <div class="flex items-start gap-2">
                <span class="text-amber-400 text-lg">📡</span>
                <div>
                    <div class="text-sm font-bold text-amber-300">カメラ・録音についての確認</div>
                    <div class="text-xs text-gray-300 mt-1 space-y-1">
                        <p>スキャン中、<strong class="text-white">カメラ映像</strong>を定期的にキャプチャし、Gemini AI で生物を同定します。</p>
                        <p>• 徒歩・自転車モードでは<strong class="text-white">環境音</strong>も録音し、BirdNET AI が鳥の声を判定します</p>
                        <p>• カメラフレームは種判定後に<strong class="text-white">自動削除</strong>されます</p>
                        <p>• 位置情報は高精度で記録されます</p>
                        <p>• データは<a href="methodology.php" class="text-blue-400 underline">ikimon.life の方針</a>に基づき管理されます</p>
                    </div>
                </div>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="consent-check" class="w-4 h-4 accent-green-500">
                <span class="text-sm text-gray-200">上記を確認しました</span>
            </label>
        </div>

        <div class="flex items-center gap-2 bg-orange-900/30 border border-orange-600/40 rounded-xl px-4 py-2">
            <span class="text-orange-400 text-base">📶</span>
            <div>
                <div class="text-xs font-bold text-orange-300">モバイルデータを使用します</div>
                <div class="text-[10px] text-orange-200/70">目安: 徒歩15分で約5〜15MB（Wi-Fi推奨）</div>
            </div>
        </div>
        </details>

        <!-- 感度モード -->
        <div class="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
            <div class="flex items-center gap-2">
                <span class="text-lg">🎤</span>
                <div>
                    <div class="text-sm font-bold text-gray-200">音声感度</div>
                    <div id="sensitivity-desc" class="text-[10px] text-gray-500">通常: 信頼度40%以上を表示</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] text-gray-500">低</span>
                <input type="range" id="sensitivity-slider" min="0" max="2" value="0" class="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500">
                <span class="text-[10px] text-gray-500">超</span>
            </div>
        </div>

        <div class="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 mb-3">
            <div class="flex items-center gap-2">
                <span class="text-lg">🔋</span>
                <div>
                    <div class="text-sm font-bold text-gray-200">省エネモード</div>
                    <div class="text-[10px] text-gray-500">カメラ間隔2倍、GPS精度を緩和（音声は通常動作）</div>
                </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="powersave-toggle" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
        </div>

        <!-- 音声ガイド -->
        <div class="space-y-2 mb-3">
            <div class="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div class="flex items-center gap-2">
                    <span class="text-lg">🔊</span>
                    <div>
                        <div class="text-sm font-bold text-gray-200">音声ガイド</div>
                        <div class="text-[10px] text-gray-500">検出時に音声で案内します</div>
                    </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="voice-guide-toggle" class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
            </div>
            <div id="vg-settings" style="display:none">
                <div class="text-[10px] text-gray-500 px-1 mb-1">出力先</div>
                <div class="flex gap-2 px-1 mb-3">
                    <button type="button" class="flex-1 py-2 rounded-lg text-xs font-bold border transition vg-output-btn active"
                            data-output="bluetooth" style="border-color:#3b82f6;background:rgba(59,130,246,0.1);color:#93c5fd">
                        📶 Bluetooth
                    </button>
                    <button type="button" class="flex-1 py-2 rounded-lg text-xs font-bold border transition vg-output-btn"
                            data-output="speaker" style="border-color:transparent;background:rgba(255,255,255,0.05);color:#9ca3af">
                        📱 端末スピーカー
                    </button>
                </div>
                <div class="text-[10px] text-gray-500 px-1 mb-1">話者</div>
                <div class="flex flex-wrap gap-2 px-1">
                    <button type="button" class="flex-1 min-w-[28%] py-2 rounded-lg text-xs font-bold border transition vg-speaker-btn active"
                            data-speaker="auto" style="border-color:#8b5cf6;background:rgba(139,92,246,0.1);color:#c4b5fd">
                        🎙️ 自動
                    </button>
                    <button type="button" class="flex-1 min-w-[28%] py-2 rounded-lg text-xs font-bold border transition vg-speaker-btn"
                            data-speaker="mochiko" style="border-color:transparent;background:rgba(255,255,255,0.05);color:#9ca3af">
                        👩 女性
                    </button>
                    <button type="button" class="flex-1 min-w-[28%] py-2 rounded-lg text-xs font-bold border transition vg-speaker-btn"
                            data-speaker="ryusei" style="border-color:transparent;background:rgba(255,255,255,0.05);color:#9ca3af">
                        👨 男性
                    </button>
                    <button type="button" class="flex-1 min-w-[28%] py-2 rounded-lg text-xs font-bold border transition vg-speaker-btn"
                            data-speaker="zundamon" style="border-color:transparent;background:rgba(255,255,255,0.05);color:#9ca3af">
                        🟢 ずんだもん
                    </button>
                </div>
                <div class="text-[9px] text-gray-600 text-right px-1 mt-2">音声: <a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener" class="underline">VOICEVOX</a></div>
            </div>
        </div>

        <button id="btn-start" class="w-full py-5 bg-green-600/50 text-green-300 cursor-not-allowed rounded-2xl text-lg font-bold transition" disabled>
            📡 スキャン開始
        </button>

        <!-- 出現予測（スキャン前のワクワク演出） -->
        <div id="predict-section" class="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/20 rounded-2xl p-4 mb-3 hidden">
            <div class="flex items-center gap-2 mb-2">
                <span class="text-sm">🔮</span>
                <span class="text-xs font-bold text-indigo-300">この場所で出会えるかも</span>
                <span id="predict-env-badge" class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 ml-auto"></span>
            </div>
            <div id="predict-list" class="space-y-2"></div>
            <div class="text-[9px] text-gray-600 mt-2">🤖 AI予測です。私有地への立入にご注意ください</div>
        </div>

        <!-- モード別の説明 -->
        <div class="bg-white/5 rounded-xl p-4 space-y-2 text-xs text-gray-400">
            <div id="mode-desc-walk">
                <div class="flex items-start gap-2"><span class="text-green-400">🎤</span><span>鳥の声をBirdNET AIが自動判定</span></div>
                <div class="flex items-start gap-2"><span class="text-blue-400">📷</span><span>カメラで植物・昆虫をGemini AIが種同定（2秒間隔）</span></div>
                <div class="flex items-start gap-2"><span class="text-purple-400">📸</span><span><strong class="text-white">撮影ボタンで即座に観察投稿</strong>も可能</span></div>
            </div>
            <div id="mode-desc-bike" style="display:none">
                <div class="flex items-start gap-2"><span class="text-green-400">🎤</span><span>走行中も鳥の声をBirdNET AIが判定</span></div>
                <div class="flex items-start gap-2"><span class="text-blue-400">📷</span><span>カメラで風景の生物を3秒間隔で種同定</span></div>
                <div class="flex items-start gap-2"><span class="text-amber-400">⚡</span><span>速度に応じてキャプチャ間隔を自動調整</span></div>
            </div>
            <div id="mode-desc-car" style="display:none">
                <div class="flex items-start gap-2"><span class="text-blue-400">📷</span><span>車窓からカメラで植生を自動検出（5秒間隔）</span></div>
                <div class="flex items-start gap-2"><span class="text-red-400">🔇</span><span>音声OFF — 車内ノイズ・ラジオの誤検出を防止</span></div>
                <div class="flex items-start gap-2"><span class="text-purple-400">📍</span><span>GPSルート沿いの植生トランセクトデータを蓄積</span></div>
            </div>
        </div>
    </div>
</div>

<!-- ===== スキャン中 ===== -->
<div id="scan-active" style="display:none">
    <video id="cam" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:55%;object-fit:cover"></video>
    <canvas id="cap" style="display:none"></canvas>

    <!-- 停止ボタン（トップバー外に配置 — モバイルのタップ判定問題を回避） -->
    <button id="btn-stop" style="position:absolute;top:8px;left:12px;padding:8px;border-radius:50%;background:rgba(255,0,0,0.6);z-index:9999;color:#fff;border:none;font-size:16px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation">✕</button>

    <!-- トップバー -->
    <div style="position:absolute;top:0;left:0;right:0;z-index:10;padding:8px 12px;background:linear-gradient(to bottom,rgba(0,0,0,0.7),transparent);display:flex;align-items:center;justify-content:space-between;padding-top:max(env(safe-area-inset-top),8px)">
        <div style="width:32px"></div>
        <div id="sensor-badges" style="display:flex;gap:6px">
            <span id="s-cam" style="font-size:10px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666">📷</span>
            <span id="s-mic" style="font-size:10px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666">🎤</span>
            <span id="s-gps" style="font-size:10px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666">📍</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px">
            <span id="data-usage" style="font-size:10px;color:#f97316;font-family:monospace;padding:2px 6px;border-radius:999px;background:rgba(249,115,22,0.15)">📶 0KB</span>
            <span id="timer" style="color:#999;font-family:monospace">0:00</span>
            <span id="geo-label" style="display:none;padding:2px 8px;border-radius:999px;background:rgba(59,130,246,0.2);color:#93c5fd;font-size:10px;font-weight:600"></span>
            <span style="padding:2px 8px;border-radius:999px;background:rgba(34,197,94,0.2);color:#4ade80;font-size:11px;font-weight:bold">
                <span id="sp-count-top" style="font-weight:900">0</span>種
            </span>
        </div>
    </div>

    <!-- 環境コンテキスト（カメラ上部にオーバーレイ） -->
    <div id="env-panel" style="display:none;position:absolute;top:50px;left:8px;z-index:10;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);border-radius:12px;padding:8px 12px;max-width:200px;font-size:11px">
        <div style="color:#4ade80;font-weight:bold;margin-bottom:4px">🌳 環境</div>
        <div id="env-text" style="color:#ccc;line-height:1.4"></div>
    </div>

    <!-- アクティビティログ -->
    <div id="debug-status" style="position:absolute;top:50px;right:8px;z-index:20;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);border-radius:10px;padding:8px 10px;font-size:10px;color:#4ade80;max-width:180px;font-family:monospace;line-height:1.5"></div>

    <!-- スキャン回数カウンター -->
    <div id="scan-pulse" style="position:absolute;bottom:46%;right:12px;z-index:10;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);border-radius:10px;padding:6px 10px;font-size:11px;color:#999">
        📷 <span id="frame-count">0</span>回 · 🎤 <span id="audio-count">0</span>回
    </div>

    <!-- 撮影ボタン（徒歩モード時のみ） -->
    <div id="capture-btn-wrap" style="display:none;position:absolute;bottom:46%;left:50%;transform:translateX(-50%);z-index:10">
        <button id="btn-capture" style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.9);border:4px solid #fff;box-shadow:0 4px 20px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform 0.1s" onclick="this.style.transform='scale(0.9)';setTimeout(()=>this.style.transform='',100)">
            📸
        </button>
        <div style="text-align:center;font-size:10px;color:#ccc;margin-top:4px">タップで投稿</div>
    </div>

    <!-- 検出バナー -->
    <div id="det-banner" style="display:none;position:absolute;bottom:46%;left:50%;transform:translateX(-50%);z-index:10;background:rgba(0,0,0,0.8);backdrop-filter:blur(12px);border-radius:16px;padding:12px 20px;text-align:center;max-width:85%;min-width:200px;border:1px solid rgba(255,255,255,0.1)">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px">
            <div id="det-name" style="font-size:18px;font-weight:900"></div>
            <span id="det-conf-badge" style="font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700"></span>
        </div>
        <div id="det-sci" style="font-size:11px;color:#ccc;font-style:italic"></div>
        <div id="det-meta" style="font-size:11px;color:#999;margin-top:4px"></div>
        <div id="det-card-info" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);text-align:left">
            <div id="det-card-trait" style="font-size:11px;color:#d1d5db;line-height:1.4"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
                <span id="det-card-habitat" style="font-size:10px;color:#9ca3af"></span>
                <span style="font-size:9px;color:#6b7280;display:flex;align-items:center;gap:2px">🤖 AI生成</span>
            </div>
        </div>
    </div>

    <!-- 下半分: 地図 + タブ -->
    <div id="bottom-panel" style="position:absolute;bottom:0;left:0;right:0;height:45%;background:#000;z-index:1">
        <div id="tab-bar" style="display:flex;gap:4px;padding:4px 8px;background:#000;overflow-x:auto">
            <button class="tab-btn active" data-tab="map" style="font-size:11px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.15);color:#fff;border:none;white-space:nowrap">🗺️ マップ</button>
            <button class="tab-btn" data-tab="log" style="font-size:11px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666;border:none;white-space:nowrap;position:relative">📋 ログ <span id="log-badge" style="display:none;position:absolute;top:-2px;right:-2px;background:#ef4444;color:#fff;font-size:9px;border-radius:999px;padding:0 4px;min-width:14px;text-align:center"></span></button>
            <button class="tab-btn" data-tab="species" style="font-size:11px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666;border:none;white-space:nowrap">🌿 種 <span id="sp-count">0</span></button>
            <button class="tab-btn" data-tab="env" style="font-size:11px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666;border:none;white-space:nowrap">🌳 環境</button>
        </div>
        <div id="tab-map" style="height:calc(100% - 32px);border-top:1px solid rgba(255,255,255,0.1)">
            <div id="minimap" style="width:100%;height:100%"></div>
        </div>
        <!-- 検出ログタブ: 時系列で全検出を閲覧できる -->
        <div id="tab-log" style="height:calc(100% - 32px);overflow-y:auto;padding:4px 8px;display:none">
            <div id="det-log-list" style="font-size:13px;display:flex;flex-direction:column;gap:4px"></div>
            <div id="det-log-empty" style="text-align:center;color:#555;font-size:12px;padding:40px 0">まだ検出なし</div>
        </div>
        <div id="tab-species" style="height:calc(100% - 32px);overflow-y:auto;padding:4px 8px;display:none">
            <!-- セッションサマリー -->
            <div id="session-summary" style="display:none;padding:8px;margin-bottom:6px;background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(59,130,246,0.15));border-radius:10px;border:1px solid rgba(34,197,94,0.2)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                    <span style="font-size:11px;font-weight:900;color:#4ade80">🎯 今回の発見</span>
                    <span id="session-elapsed" style="font-size:10px;color:#888;font-family:monospace"></span>
                </div>
                <div style="display:flex;gap:12px;font-size:12px">
                    <div><span style="font-size:18px;font-weight:900;color:#fff" id="sum-species">0</span><span style="color:#888;font-size:10px;margin-left:2px">種</span></div>
                    <div>📷<span style="font-weight:700;color:#60a5fa;margin-left:2px" id="sum-visual">0</span></div>
                    <div>🎤<span style="font-weight:700;color:#fbbf24;margin-left:2px" id="sum-audio">0</span></div>
                </div>
            </div>
            <!-- カメラ検出セクション -->
            <div id="visual-section" style="display:none;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:4px;padding:4px 0;border-bottom:1px solid rgba(96,165,250,0.2);margin-bottom:4px">
                    <span style="font-size:11px">📷</span>
                    <span style="font-size:11px;font-weight:700;color:#60a5fa">カメラ検出</span>
                    <span id="visual-count" style="font-size:10px;color:#888;margin-left:auto">0種</span>
                </div>
                <div id="visual-list" style="font-size:13px"></div>
            </div>
            <!-- 音声検出セクション -->
            <div id="audio-section" style="display:none;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:4px;padding:4px 0;border-bottom:1px solid rgba(251,191,36,0.2);margin-bottom:4px">
                    <span style="font-size:11px">🎤</span>
                    <span style="font-size:11px;font-weight:700;color:#fbbf24">音声検出（鳥）</span>
                    <span id="audio-sp-count" style="font-size:10px;color:#888;margin-left:auto">0種</span>
                </div>
                <div id="audio-list" style="font-size:13px"></div>
            </div>
            <div id="species-empty" style="text-align:center;color:#555;font-size:12px;padding:40px 0">まだ検出なし</div>
        </div>
        <div id="tab-env" style="height:calc(100% - 32px);overflow-y:auto;padding:8px;display:none">
            <div id="env-log" style="font-size:12px"></div>
            <div id="env-empty" style="text-align:center;color:#555;font-size:12px;padding:40px 0">環境スキャン待ち（10秒ごとに自動実行）</div>
        </div>
    </div>
</div>

<!-- ===== スキャン完了 ===== -->
<div id="scan-done" style="display:none" class="min-h-screen bg-gradient-to-br from-blue-950 to-purple-950 text-white">
    <div class="max-w-lg mx-auto px-4 py-12">
        <div class="text-center mb-8">
            <span class="text-5xl mb-4 block">📡</span>
            <h2 class="text-2xl font-black mb-2">スキャン完了！</h2>
            <p id="done-summary" class="text-blue-200 text-sm"></p>
        </div>
        <div id="done-quests" class="space-y-3 mb-8" style="display:none">
            <div class="flex items-center gap-2 mb-4">
                <i data-lucide="notebook-pen" class="w-5 h-5 text-emerald-400"></i>
                <h3 class="text-base font-black text-emerald-300">フィールドノート</h3>
                <span class="text-[10px] text-emerald-400/50 ml-auto">自然からの呼びかけ</span>
            </div>
            <div id="done-quest-list"></div>
        </div>
        <!-- 今日のベスト発見 -->
        <div id="scan-recap-best" class="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border border-emerald-500/20 rounded-2xl p-5 mb-4 hidden">
            <div class="text-[10px] text-emerald-400/70 font-bold mb-1">今日のベスト発見</div>
            <div id="scan-recap-best-name" class="text-xl font-black text-emerald-300"></div>
            <div id="scan-recap-best-sci" class="text-xs text-emerald-400/60 font-italic mb-2"></div>
            <div id="scan-recap-best-note" class="text-sm text-gray-200 leading-relaxed mb-2"></div>
            <a id="scan-recap-best-link" href="#" class="text-xs text-emerald-400 hover:underline">📖 図鑑で詳しく見る →</a>
        </div>

        <!-- AIストーリー -->
        <div id="scan-recap-narrative" class="bg-white/10 rounded-2xl p-5 mb-4 hidden">
            <div id="scan-recap-narrative-text" class="text-sm text-gray-200 leading-relaxed"></div>
            <div class="text-[9px] text-gray-500 mt-2 flex items-center gap-1">🤖 AIによる要約です。事実と異なる場合があります</div>
        </div>

        <!-- 出会った生物ギャラリー -->
        <div id="scan-recap-gallery" class="mb-4 hidden">
            <h3 class="text-sm font-bold text-gray-300 mb-2">出会った生物</h3>
            <div id="scan-recap-gallery-scroll" class="flex gap-3 overflow-x-auto pb-2" style="-webkit-overflow-scrolling:touch"></div>
        </div>

        <!-- 貢献 -->
        <div id="scan-recap-contribution" class="bg-white/10 rounded-2xl p-5 mb-4 hidden">
            <h3 class="text-sm font-bold text-gray-300 mb-3">あなたの貢献</h3>
            <div id="scan-recap-contrib-list" class="space-y-2"></div>
        </div>

        <!-- バッジ -->
        <div id="scan-recap-badges" class="bg-gradient-to-r from-amber-900/30 to-purple-900/30 rounded-2xl p-5 mb-4 hidden">
            <div id="scan-recap-badges-content"></div>
        </div>

        <div class="flex items-start gap-2 bg-white/10 rounded-xl px-4 py-3 mb-6">
            <i data-lucide="database" class="w-4 h-4 text-blue-300 shrink-0 mt-0.5"></i>
            <p class="text-xs text-blue-100">検出データは地域の生物多様性DBに蓄積され、BISスコア・TNFDレポートに活用されます</p>
        </div>
        <div class="flex gap-3">
            <button onclick="showScreen('ready')" class="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl py-3 text-sm transition">
                もう一度スキャン
            </button>
            <a href="zukan.php" class="flex-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl py-3 text-sm text-center transition">
                📖 図鑑で復習
            </a>
        </div>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
var S = {
    active: false, startTime: null, timerInt: null,
    mode: 'walk', // walk | bike | car
    stream: null, captureInt: null, envInt: null, watchId: null, envHistory: [],
    frameScanCount: 0, audioScanCount: 0, capturedPhotos: [],
    routePoints: [], speciesMap: {}, totalDet: 0, audioDet: 0, visualDet: 0,
    minimap: null, posMarker: null,
    recorder: null, recTimer: null, analyzing: false, chunks: [], mime: '',
    dataUsage: 0,
    sensitivityLevel: 0, // 0=通常, 1=高感度, 2=超高感度
    speciesCardCache: {},
    totalPoints: 0,
    audioEmptyStreak: 0,
    detectionLog: [], // 時系列検出ログ（ドロワー表示用）
    logDrawerOpen: false,
};

function formatDataUsage(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(0) + 'KB';
    return (bytes/(1024*1024)).toFixed(1) + 'MB';
}
function updateDataUsage(addBytes) {
    S.dataUsage += addBytes;
    var el = document.getElementById('data-usage');
    if (el) {
        el.textContent = '📶 ' + formatDataUsage(S.dataUsage);
        el.style.color = S.dataUsage > 10*1024*1024 ? '#ef4444' : '#f97316';
    }
}

// ===== Screen =====
function showScreen(name) {
    document.getElementById('scan-ready').style.display = name === 'ready' ? '' : 'none';
    document.getElementById('scan-active').style.display = name === 'active' ? '' : 'none';
    document.getElementById('scan-done').style.display = name === 'done' ? '' : 'none';
    if (name === 'done') lucide.createIcons();
}

// ===== Start =====
function dbg(msg) {
    var el = document.getElementById('debug-status');
    if (el) el.innerHTML = msg + '<br>' + (el.innerHTML || '').split('<br>').slice(0, 8).join('<br>');
    console.log('[scan] ' + msg);
    // サーバーにログ送信（音声ガイドデバッグ用）
    if (msg.indexOf('🔊') >= 0 || msg.indexOf('🔇') >= 0 || msg.indexOf('ERR') >= 0) {
        navigator.sendBeacon('/api/v2/client_log.php', JSON.stringify({msg: msg, ts: Date.now(), ua: navigator.userAgent.substring(0,80)}));
    }
}

function applyDriveLayout() {
    var cam = document.getElementById('cam');
    if (cam) cam.style.display = 'none';
    var bp = document.getElementById('bottom-panel');
    if (bp) bp.style.display = 'none';
    var dbgEl = document.getElementById('debug-status');
    if (dbgEl) { dbgEl.style.top = 'auto'; dbgEl.style.bottom = '8px'; dbgEl.style.right = '8px'; dbgEl.style.maxWidth = '90%'; dbgEl.style.fontSize = '9px'; dbgEl.style.opacity = '0.6'; }
    var pulse = document.getElementById('scan-pulse');
    if (pulse) pulse.style.display = 'none';
    var envP = document.getElementById('env-panel');
    if (envP) envP.style.display = 'none';
    var badges = document.getElementById('sensor-badges');
    if (badges) badges.style.display = 'none';
    var dataU = document.getElementById('data-usage');
    if (dataU) dataU.style.display = 'none';
    var banner = document.getElementById('det-banner');
    if (banner) { banner.style.bottom = 'auto'; banner.style.top = '50%'; banner.style.transform = 'translate(-50%,-50%)'; banner.style.fontSize = '120%'; }
    var active = document.getElementById('scan-active');
    if (active) active.style.background = '#000';
    var bp = document.getElementById('bottom-panel');
    if (bp) bp.style.display = 'none';
    // ステータス + ガイド状態
    var driveStatus = document.createElement('div');
    driveStatus.id = 'drive-status';
    driveStatus.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:5';
    driveStatus.innerHTML = '<div style="font-size:48px;margin-bottom:12px" id="drive-icon">📡</div>'
        + '<div style="font-size:16px;color:#4ade80;font-weight:bold" id="drive-label">スキャン中</div>'
        + '<div id="drive-voice-status" style="font-size:12px;color:#60a5fa;margin-top:8px">🔊 ガイド準備中...</div>'
        + '<div id="drive-species" style="font-size:11px;color:#888;margin-top:8px"></div>';
    active.appendChild(driveStatus);
}

async function startScan() {
    showScreen('active');
    // 全モード共通: 停止ボタンを画面下部に大きく固定配置
    var stopBtn = document.getElementById('btn-stop');
    if (stopBtn) {
        stopBtn.style.cssText = 'position:fixed;bottom:max(env(safe-area-inset-bottom,8px),12px);left:50%;transform:translateX(-50%);padding:14px 40px;border-radius:16px;background:rgba(255,0,0,0.85);color:#fff;font-size:16px;font-weight:bold;border:2px solid rgba(255,255,255,0.4);z-index:9999;box-shadow:0 4px 20px rgba(255,0,0,0.4);-webkit-tap-highlight-color:transparent;touch-action:manipulation';
        stopBtn.textContent = '■ スキャン終了';
    }
    if (S.mode === 'car') applyDriveLayout();
    dbg('1. 画面切替OK');
    S.active = true;
    S.startTime = Date.now();
    S.speciesMap = {}; S.totalDet = 0; S.audioDet = 0; S.visualDet = 0;
    S.routePoints = []; S.envHistory = []; S.dataUsage = 0;
    S.sessionId = 'ls_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    S.pendingEvents = [];
    S.sentEventCount = 0;
    S.batchTimer = null;
    S.serverSessionId = null;
    S.audioEmptyStreak = 0;
    S._audioResuming = false;
    S._lastEnvPos = null;
    updateCounts();

    // 30秒ごとに増分送信
    S.batchTimer = setInterval(flushEvents, 30000);

    // Timer
    S.timerInt = setInterval(function() {
        if (document.hidden) return; // 画面非表示時はUI更新スキップ（省電力）
        var sec = Math.floor((Date.now() - S.startTime) / 1000);
        var timeStr = Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
        document.getElementById('timer').textContent = timeStr;
        var el = document.getElementById('session-elapsed');
        if (el) el.textContent = timeStr;
        if (sec % 10 === 0 && Object.keys(S.speciesMap).length > 0) updateSpeciesList();
    }, 1000);
    dbg('2. タイマー開始');

    // Camera + Audio
    try {
        dbg('3. カメラ要求中...');
        S.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 } },
            audio: true
        });
        dbg('4. カメラ取得OK');
        document.getElementById('cam').srcObject = S.stream;
        setSensor('cam', true);
        setSensor('mic', true);

        var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        S.isWifi = !conn || conn.type === 'wifi' || conn.type === 'ethernet';

        // バッテリー監視
        S.batteryLevel = 1.0;
        S.isCharging = false;
        S.manualPowerSave = !!document.getElementById('powersave-toggle').checked;
        S.powerSaveMode = S.manualPowerSave;
        if (navigator.getBattery) {
            navigator.getBattery().then(function(batt) {
                S.batteryLevel = batt.level;
                S.isCharging = batt.charging;
                batt.addEventListener('levelchange', function() {
                    S.batteryLevel = batt.level;
                    checkPowerSave();
                });
                batt.addEventListener('chargingchange', function() {
                    S.isCharging = batt.charging;
                    checkPowerSave();
                });
                checkPowerSave();
            });
        }

        // アダプティブキャプチャ間隔
        S.baseCaptureMs = S.mode === 'car' ? 5000 : S.mode === 'bike' ? 3000 : 2000;
        S.currentSpeed = 0;
        S.prescreenSkipped = 0;
        scheduleNextCapture();
        S.envInt = setInterval(envScan, S.isWifi ? 10000 : 30000);
        setTimeout(envScan, 3000);
        dbg('5. ' + S.mode + ' アダプティブ間隔');

        // TF.js プレスクリーン非同期初期化（スキャン開始をブロックしない）
        if (typeof BioPrescreen !== 'undefined') {
            BioPrescreen.init().then(function(ok) {
                dbg(ok ? '🧠 プレスクリーン準備完了' : '🧠 フォールバック: 全フレーム送信');
            });
        }

        // GeoContext: 環境ラベルを取得してステータスバーに表示
        var geoPos = S.routePoints.length > 0 ? S.routePoints[0] : null;
        if (geoPos) {
            fetch('/api/v2/geo_context.php?lat=' + geoPos.lat + '&lng=' + geoPos.lng)
                .then(function(r) { return r.json(); })
                .then(function(j) {
                    if (j.success && j.data && j.data.environment_label) {
                        var gl = document.getElementById('geo-label');
                        gl.textContent = j.data.environment_icon + ' ' + j.data.environment_label;
                        gl.style.display = '';
                        S.geoContext = j.data;
                        dbg('🗺️ ' + j.data.environment_label);
                    }
                }).catch(function() {});
        }

        // 音声: 車モードはOFF（ノイズ・ラジオ誤検出防止）
        if (S.mode !== 'car') {
            setupAudioRecorder();
            dbg('6. 音声ON');
        } else {
            dbg('6. 音声OFF（車モード）');
        }

        // 撮影ボタン: 徒歩モードのみ表示
        if (S.mode === 'walk') {
            document.getElementById('capture-btn-wrap').style.display = '';
        }
    } catch(e) {
        dbg('ERR カメラ/音声: ' + e.message);
    }

    // GPS（スマート切替: 移動中=watchPosition, 静止時=polling で省電力）
    S._gpsStillSince = 0;
    S._gpsPolling = false;
    S._gpsPollTimer = null;
    if (navigator.geolocation) {
        startGpsWatch();
    }

    // 音声ガイド: 強制同期（トグルがONなら確実に有効化）
    var vgOn = document.getElementById('voice-guide-toggle');
    var vgChecked = vgOn && vgOn.checked;
    dbg('🔊 toggle=' + vgChecked + ' VG=' + (typeof VoiceGuide !== 'undefined' ? VoiceGuide.isEnabled() : 'undef'));
    if (vgChecked) {
        try { VoiceGuide.setEnabled(true); } catch(e) { dbg('🔊 setEnabled err: ' + e.message); }
    }
    var vgActive = false;
    try { vgActive = VoiceGuide.isEnabled(); } catch(e) { dbg('🔊 isEnabled err: ' + e.message); }

    if (vgActive) {
        var vgMode = VoiceGuide.getVoiceMode();
        dbg('🔊 ON mode=' + vgMode);
        // モバイルブラウザの自動再生ロック解除（ユーザージェスチャー内で空発話）
        if ('speechSynthesis' in window) {
            var unlock = new SpeechSynthesisUtterance('');
            unlock.volume = 0;
            speechSynthesis.speak(unlock);
        }
        // 初回ガイド取得（GPS取得前なのでデフォルト座標、すぐGPS更新で上書きされる）
        S._ambientCount = 0;
        S._lastVoiceTime = 0;
        S._vgMode = vgMode;
        _fetchAmbientNow();
        // 以降はGPS更新・カメラキャプチャ時にトリガー（setTimeoutはスリープで凍結されるため使わない）
    } else {
        dbg('🔇 OFF');
    }
}

function handleGpsPosition(pos) {
    setSensor('gps', true);
    var acc = pos.coords.accuracy || 999;
    S.currentSpeed = pos.coords.speed || 0;
    if (acc <= 50) {
        S.routePoints.push({lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now(), speed: S.currentSpeed, accuracy: acc});
        if (S.routePoints.length === 1) {
            initMap(pos.coords.latitude, pos.coords.longitude);
            dbg('7. GPS+マップ初期化 (精度' + Math.round(acc) + 'm)');
        }
        if (!document.hidden) updateMapRoute();
    }
    S.lastGpsPos = {lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc};

    // 音声ガイド: GPS更新をトリガーにアンビエント発話
    tryAmbient();

    // 静止検出: speed < 0.3 が30秒続いたら polling に切替
    if (S.currentSpeed < 0.3) {
        if (!S._gpsStillSince) S._gpsStillSince = Date.now();
        if (!S._gpsPolling && Date.now() - S._gpsStillSince > 30000) {
            switchToGpsPolling();
        }
    } else {
        S._gpsStillSince = 0;
        if (S._gpsPolling) switchToGpsWatch();
    }
}

function startGpsWatch() {
    S._gpsPolling = false;
    if (S._gpsPollTimer) { clearInterval(S._gpsPollTimer); S._gpsPollTimer = null; }
    S.watchId = navigator.geolocation.watchPosition(handleGpsPosition,
        function(e) { dbg('GPS ERR: ' + e.message); },
        {enableHighAccuracy: true, maximumAge: 3000, timeout: 10000});
}

function switchToGpsPolling() {
    if (S._gpsPolling) return;
    S._gpsPolling = true;
    if (S.watchId) { navigator.geolocation.clearWatch(S.watchId); S.watchId = null; }
    dbg('GPS → polling (静止中)');
    S._gpsPollTimer = setInterval(function() {
        if (!S.active) return;
        navigator.geolocation.getCurrentPosition(handleGpsPosition,
            function() {}, {enableHighAccuracy: true, maximumAge: 10000, timeout: 10000});
    }, 15000);
}

function switchToGpsWatch() {
    if (!S._gpsPolling) return;
    dbg('GPS → watch (移動再開)');
    if (S._gpsPollTimer) { clearInterval(S._gpsPollTimer); S._gpsPollTimer = null; }
    startGpsWatch();
}

// ===== Adaptive Capture Scheduling =====
function getAdaptiveCaptureMs() {
    var base = S.baseCaptureMs;
    if (S.powerSaveMode) base *= 2;
    if (S.mode === 'walk') {
        var speed = S.currentSpeed || 0;
        if (speed < 0.3) base = Math.max(base, 12000); // 静止 → 12秒（景色変わらない）
        else if (speed > 2.0) base = Math.min(base, 1500);
    }
    return base;
}

function scheduleNextCapture() {
    if (!S.active) return;
    var ms = getAdaptiveCaptureMs();
    S.captureInt = setTimeout(function() {
        if (!S.active) return;
        captureFrame();
        scheduleNextCapture();
    }, ms);
}

function checkPowerSave() {
    var wasPowerSave = S.powerSaveMode;
    if (S.batteryLevel <= 0.10 && !S.isCharging) {
        // 10%以下: カメラ停止、音声のみ
        S.powerSaveMode = true;
        if (!wasPowerSave) {
            dbg('🔋 超省エネ: カメラOFF');
            showScanToast('🔋 省エネモード (音声のみ)');
            if (S.captureInt) { clearTimeout(S.captureInt); S.captureInt = null; }
        }
    } else if (S.batteryLevel <= 0.20 && !S.isCharging) {
        // 20%以下: 間隔2倍
        S.powerSaveMode = true;
        if (!wasPowerSave) {
            dbg('🔋 省エネモード');
            showScanToast('🔋 省エネモード ON');
        }
    } else {
        S.powerSaveMode = S.manualPowerSave || false;
    }
}

function getAdaptiveAudioMs() {
    if (S.sensitivityLevel >= 2) return S.powerSaveMode ? 6000 : 3000; // 超高感度: ペナルティなし
    var base = 3000;
    if (S.powerSaveMode) base = 6000;
    if (S.audioEmptyStreak >= 10) base = Math.max(base, 6000);
    else if (S.audioEmptyStreak >= 5) base = Math.max(base, 4000);
    return base;
}

// ===== Stop =====
function stopScan() {
    S.active = false;

    // リソース解放（各行を try/catch で保護 — 1つの失敗で終了遷移が止まらないように）
    try { clearInterval(S.timerInt); } catch(e) {}
    try { if (S.captureInt) clearTimeout(S.captureInt); } catch(e) {}
    try { clearInterval(S.envInt); } catch(e) {}
    try { if (S.batchTimer) clearInterval(S.batchTimer); } catch(e) {}
    try { if (S.recTimer) clearTimeout(S.recTimer); } catch(e) {}
    try { VoiceGuide.stop(); } catch(e) { dbg('⚠️ VoiceGuide.stop err: ' + e.message); }
    try { if (_ambientTimer) { clearInterval(_ambientTimer); _ambientTimer = null; } } catch(e) {}
    try { if (S.recorder && S.recorder.state === 'recording') S.recorder.stop(); } catch(e) {}
    try { if (S.watchId) navigator.geolocation.clearWatch(S.watchId); } catch(e) {}
    try { if (S._gpsPollTimer) clearInterval(S._gpsPollTimer); } catch(e) {}
    try { if (S.stream) S.stream.getTracks().forEach(function(t) { t.stop(); }); } catch(e) {}
    try { if (S.audioCtx) S.audioCtx.close(); } catch(e) {}
    try { if (S.minimap) { S.minimap.remove(); S.minimap = null; } } catch(e) {}

    var sp = Object.keys(S.speciesMap).length;
    var sec = Math.floor((Date.now() - S.startTime) / 1000);
    var min = Math.floor(sec / 60);

    try { postScanSummary(sp, min); } catch(e) {}

    var summaryText = sp + '種検出 · ' + min + '分間のスキャン · 📶 ' + formatDataUsage(S.dataUsage);
    if (typeof BioPrescreen !== 'undefined' && BioPrescreen.stats.total > 0) {
        summaryText += ' · 🧠 ' + BioPrescreen.getGeminiSaveRate() + '%ローカル分析';
    }
    summaryText += ' · 送信済 ' + S.sentEventCount + '件';
    document.getElementById('done-summary').textContent = summaryText;
    showScreen('done');

    var speciesList = Object.entries(S.speciesMap).map(function(e) {
        return {name: e[0], scientific_name: '', confidence: e[1].confidence, count: e[1].count};
    });
    try { fetchScanRecap(speciesList, sec); } catch(e) {}

    // 最終フラッシュ（未送信分 + セッション完了通知）
    try { flushEvents(true); } catch(e) {}
}

// ===== 増分バッチ送信 =====
function flushEvents(isFinal) {
    var events = S.pendingEvents || [];
    if (events.length === 0 && !isFinal) return;

    var batch = events.splice(0, events.length);
    var sec = Math.floor((Date.now() - S.startTime) / 1000);
    var payload = {
        events: batch,
        session: {
            duration_sec: sec,
            distance_m: calcDistance(S.routePoints),
            route_polyline: S.routePoints.map(function(p){return p.lat.toFixed(6)+','+p.lng.toFixed(6)}).join(';'),
            device: navigator.userAgent.indexOf('iPhone') >= 0 ? 'iPhone' : 'Android',
            app_version: 'web_1.0',
            scan_mode: 'live-scan',
            session_id_client: S.sessionId,
            is_incremental: !isFinal,
        }
    };
    if (isFinal) {
        payload.env_history = S.envHistory;
        payload.session.is_final = true;
    }

    fetch('/api/v2/passive_event.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify(payload)
    }).then(function(r) {
        if (r.status === 401) {
            dbg('⚠️ ログイン切れ — 再ログインが必要です');
            saveScanPending(batch, payload.session);
            if (typeof showToast === 'function') showToast('ログインが切れました。再ログインしてください', 'warning');
            setTimeout(function(){ window.location.href = '/login.php?redirect=' + encodeURIComponent(location.pathname); }, 2000);
            return null;
        }
        if (r.status === 429) {
            dbg('⏳ レート制限 — 10秒後にリトライ');
            saveScanPending(batch, payload.session);
            return null;
        }
        return r.json();
    })
    .then(function(data) {
        if (!data) return;
        if (data.success) {
            S.sentEventCount += batch.length;
            if (data.data && data.data.session_id) S.serverSessionId = data.data.session_id;
            dbg('📡 ' + batch.length + '件送信OK (計' + S.sentEventCount + ')');
            removePendingFromStorage(batch);
            if (isFinal && data.scan_quests && data.scan_quests.length > 0) {
                renderScanQuests(data.scan_quests);
            }
        } else {
            var errMsg = (data.error && data.error.message) || 'サーバーエラー';
            dbg('❌ 送信エラー: ' + errMsg);
            saveScanPending(batch, payload.session);
        }
    }).catch(function(e) {
        if (navigator.onLine) {
            dbg('❌ サーバー接続エラー（データは保存済み）');
        } else {
            dbg('📱 オフライン — データを保存しました');
        }
        saveScanPending(batch, payload.session);
    });

    // バックアップは catch 内でのみ保存（成功時の二重書込を廃止して省電力）
}

// ===== localStorage バックアップ =====
function saveScanPending(events, session) {
    try {
        var key = 'ikimon_scan_pending';
        var existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push({
            events: events,
            session: session,
            sessionId: S.sessionId,
            savedAt: new Date().toISOString()
        });
        // 古いデータ（48時間超）を削除
        var cutoff = Date.now() - 48 * 3600 * 1000;
        existing = existing.filter(function(p) { return new Date(p.savedAt).getTime() > cutoff; });
        localStorage.setItem(key, JSON.stringify(existing));
    } catch(e) {}
}

function removePendingFromStorage(sentEvents) {
    try {
        var key = 'ikimon_scan_pending';
        var existing = JSON.parse(localStorage.getItem(key) || '[]');
        // 送信成功したセッションのデータを削除
        existing = existing.filter(function(p) { return p.sessionId !== S.sessionId; });
        localStorage.setItem(key, JSON.stringify(existing));
    } catch(e) {}
}

async function retryScanPending() {
    try {
        var key = 'ikimon_scan_pending';
        var pending = JSON.parse(localStorage.getItem(key) || '[]');
        if (pending.length === 0) return;
        dbg('📱 未送信 ' + pending.length + '件を再送中...');
        var remaining = [];
        for (var i = 0; i < pending.length; i++) {
            try {
                var p = pending[i];
                var resp = await fetch('/api/v2/passive_event.php', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    credentials: 'same-origin',
                    body: JSON.stringify({events: p.events, session: p.session})
                });
                if (resp.status === 401) {
                    remaining = remaining.concat(pending.slice(i));
                    dbg('⚠️ 再送中にログイン切れ');
                    break;
                }
                var json = await resp.json();
                if (!json.success) remaining.push(p);
            } catch(e) {
                remaining = remaining.concat(pending.slice(i));
                break;
            }
        }
        localStorage.setItem(key, JSON.stringify(remaining));
        if (pending.length > remaining.length) {
            dbg('✅ ' + (pending.length - remaining.length) + '件再送成功');
        }
    } catch(e) {}
}

async function fetchScanRecap(speciesList, durationSec) {
    if (speciesList.length === 0) return;
    try {
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
        var envWeather = (S.envHistory && S.envHistory.length > 0 && S.envHistory[0].weather) ? S.envHistory[0].weather : null;
        var resp = await fetch('/api/v2/session_recap.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                species: speciesList,
                duration_sec: durationSec,
                distance_m: calcDistance(S.routePoints),
                lat: last ? last.lat : 0,
                lng: last ? last.lng : 0,
                scan_mode: 'live-scan',
                hour: new Date().getHours(),
                weather: envWeather,
            })
        });
        if (!resp.ok) return;
        var json = await resp.json();
        if (!json.success || !json.data) return;
        var d = json.data;

        // 今日のベスト発見（最も信頼度が高い種）
        if (d.species_cards && d.species_cards.length > 0) {
            var best = d.species_cards.reduce(function(a, b) { return (a.confidence || 0) >= (b.confidence || 0) ? a : b; });
            if (best && best.name) {
                document.getElementById('scan-recap-best-name').textContent = best.name;
                document.getElementById('scan-recap-best-sci').textContent = best.scientific_name || '';
                var bestNote = best.morphological_traits || best.notes || (S.speciesMap[best.name] ? S.speciesMap[best.name].note : '') || '';
                if (bestNote.length > 120) bestNote = bestNote.substring(0, 120) + '...';
                document.getElementById('scan-recap-best-note').textContent = bestNote;
                var sciQ = encodeURIComponent(best.scientific_name || best.name);
                document.getElementById('scan-recap-best-link').href = 'zukan.php?q=' + sciQ;
                document.getElementById('scan-recap-best').classList.remove('hidden');
            }
        }

        if (d.narrative) {
            document.getElementById('scan-recap-narrative-text').textContent = d.narrative;
            document.getElementById('scan-recap-narrative').classList.remove('hidden');
        }

        if (d.species_cards && d.species_cards.length > 0) {
            var scroll = document.getElementById('scan-recap-gallery-scroll');
            scroll.innerHTML = d.species_cards.map(function(c) {
                var cc = c.confidence >= 0.7 ? '#4ade80' : c.confidence >= 0.4 ? '#fbbf24' : '#999';
                var t = c.morphological_traits || c.notes || '';
                if (t.length > 60) t = t.substring(0, 60) + '...';
                return '<div style="min-width:170px;max-width:190px;background:rgba(255,255,255,0.08);border-radius:14px;padding:10px;flex-shrink:0">'
                    + '<div style="font-size:14px;font-weight:800;color:' + cc + '">' + (c.name || '') + '</div>'
                    + (c.scientific_name ? '<div style="font-size:10px;color:#999;font-style:italic">' + c.scientific_name + '</div>' : '')
                    + '<div style="font-size:11px;color:#d1d5db;margin-top:4px;line-height:1.3">' + t + '</div>'
                    + (c.habitat ? '<div style="font-size:10px;color:#6b7280;margin-top:3px">🌿 ' + c.habitat + '</div>' : '')
                    + '</div>';
            }).join('');
            document.getElementById('scan-recap-gallery').classList.remove('hidden');
        }

        if (d.contribution && d.contribution.length > 0) {
            document.getElementById('scan-recap-contrib-list').innerHTML = d.contribution.map(function(c) {
                if (c.highlight) {
                    return '<div style="background:linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08));border:1px solid rgba(251,191,36,0.3);border-radius:10px;padding:8px 10px;margin-bottom:4px" class="flex items-start gap-2 text-sm"><span>' + c.icon + '</span><span style="color:#fde68a;font-weight:600">' + c.text + '</span></div>';
                }
                return '<div class="flex items-start gap-2 text-sm" style="margin-bottom:2px"><span>' + c.icon + '</span><span class="text-blue-100">' + c.text + '</span></div>';
            }).join('');
            document.getElementById('scan-recap-contribution').classList.remove('hidden');
        }

        if (d.rank_progress && (d.rank_progress.rank_up || (d.rank_progress.badges_earned && d.rank_progress.badges_earned.length > 0))) {
            var bp = d.rank_progress, html = '';
            if (bp.rank_up) html += '<div class="text-center mb-2"><span class="text-2xl">🎊</span><div class="text-sm font-bold text-amber-300">ランクアップ!</div><div class="text-lg font-black">' + (bp.current_rank||'') + '</div></div>';
            if (bp.badges_earned && bp.badges_earned.length > 0) html += '<div class="flex flex-wrap gap-2 justify-center">' + bp.badges_earned.map(function(b) { return '<span class="text-xs px-3 py-1 bg-amber-600/30 text-amber-300 rounded-full font-bold">' + (b.name||b) + '</span>'; }).join('') + '</div>';
            if (html) { document.getElementById('scan-recap-badges-content').innerHTML = html; document.getElementById('scan-recap-badges').classList.remove('hidden'); }
        }
    } catch(e) { console.warn('Scan recap error:', e); }
}

function renderScanQuests(quests) {
    var container = document.getElementById('done-quests');
    var list = document.getElementById('done-quest-list');
    container.style.display = '';
    list.innerHTML = '';

    if (!quests || quests.length === 0) {
        list.innerHTML = '<div class="text-center py-6 text-sm text-emerald-200/50">' +
            '今回は特別な発見はありませんでした。<br>' +
            '<span class="text-[11px]">でも、すべての観察がこの地域のデータに蓄積されています。</span></div>';
        lucide.createIcons();
        return;
    }

    var badgeColors = {
        redlist:          'background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3)',
        area_first:       'background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3)',
        id_challenge:     'background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.3)',
        evidence_upgrade: 'background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3)',
        new_species:      'background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3)',
        photo_needed:     'background:rgba(156,163,175,0.15);color:#9ca3af;border:1px solid rgba(156,163,175,0.3)',
    };

    quests.forEach(function(q) {
        var badgeStyle = badgeColors[q.trigger] || badgeColors.photo_needed;
        var label = q.rarity_label || q.trigger;
        var cta = q.cta_text || '記録する';
        var ttlHours = Math.max(1, Math.floor((new Date(q.expires_at).getTime() - Date.now()) / 3600000));

        var div = document.createElement('div');
        div.style.cssText = 'background:rgba(255,255,255,0.06);border-radius:14px;padding:14px 16px;margin-bottom:8px';

        div.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
                '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;' + badgeStyle + '">' + escHtml(label) + '</span>' +
                '<span style="font-size:10px;color:#666;margin-left:auto">⏱ 残り' + ttlHours + '時間</span>' +
            '</div>' +
            '<div style="font-size:14px;font-weight:900;margin-bottom:6px">' + escHtml(q.title) + '</div>' +
            (q.progress_hint ? '<div style="font-size:11px;color:#4ade80;margin-bottom:6px;padding:4px 8px;background:rgba(34,197,94,0.1);border-radius:6px">' + escHtml(q.progress_hint) + '</div>' : '') +
            '<div style="font-size:12px;color:#a1a1aa;margin-bottom:10px;line-height:1.5">' + escHtml(q.description) + '</div>' +
            '<div style="display:flex;align-items:center;gap:8px">' +
                '<a href="post.php?species=' + encodeURIComponent(q.species_name) + '&from=scan_quest&quest_id=' + encodeURIComponent(q.id) +
                    (q.trigger === 'id_challenge' ? '&family_hint=' + encodeURIComponent(q.species_name) : '') +
                    '" style="flex:1;display:block;text-align:center;padding:10px;border-radius:10px;font-size:13px;font-weight:700;' +
                    'background:rgba(16,185,129,0.2);color:#4ade80;text-decoration:none;transition:background 0.2s">' +
                    escHtml(cta) + '</a>' +
                '<span style="font-size:10px;color:#666">+' + q.reward + 'pt</span>' +
            '</div>';
        list.appendChild(div);
    });
    lucide.createIcons();
}

function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ===== Camera Capture =====
async function captureFrame() {
    if (!S.active) return;
    try {
        var v = document.getElementById('cam');
        var c = document.getElementById('cap');
        if (!v.videoWidth) { dbg('📷 待機中(videoWidth=0)'); return; }
        // Wi-Fi: 640px/q0.7、モバイル: 320px/q0.5（通信量半減）
        var maxW = S.isWifi ? 640 : 320;
        var quality = S.isWifi ? 0.7 : 0.5;
        c.width = Math.min(v.videoWidth, maxW);
        c.height = Math.round(c.width * v.videoHeight / v.videoWidth);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

        // Layer 1: MobileNet 分析（全フレーム、¥0）
        var analysis = null;
        var mobilenetClasses = [];
        if (typeof BioPrescreen !== 'undefined' && BioPrescreen.available) {
            analysis = await BioPrescreen.analyze(c);
            // MobileNet の検出結果をローカル記録（データ100%保持）
            if (analysis.localDetections.length > 0) {
                analysis.localDetections.forEach(function(det) {
                    mobilenetClasses.push(det.className);
                    // MobileNet 結果に既に Gemini マッピングがあればローカルで addDetection
                    var known = BioPrescreen.getKnownClasses()[det.className];
                    if (known && known.geminiMapping && !det.isNew) {
                        known.geminiMapping.forEach(function(gm) {
                            addDetection(gm.name, gm.scientific_name || '', det.probability * 0.7, 'visual', gm.category || '', gm.note || '');
                        });
                    }
                });
            }
        }

        S.frameScanCount++;
        document.getElementById('frame-count').textContent = S.frameScanCount;

        // Layer 2: Gemini API（新種・不明・定期サンプリング時のみ）
        var needGemini = !analysis || analysis.needGemini;
        if (!needGemini) {
            dbg('📷 #' + S.frameScanCount + ' ローカル記録 (' + analysis.reason + ')');
            return;
        }

        var blob = await new Promise(function(r) { c.toBlob(r, 'image/jpeg', quality); });
        updateDataUsage(blob.size);
        var fd = new FormData();
        fd.append('photo', blob, 'scan.jpg');
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
        if (last) { fd.append('lat', last.lat); fd.append('lng', last.lng); }

        var ctx = {};
        if (S.envHistory.length > 0) {
            var env = S.envHistory[0];
            ctx.environment = {habitat: env.habitat||'', vegetation: env.vegetation||'', canopy_cover: env.canopy_cover||'', water: env.water||''};
        }
        var entries = Object.entries(S.speciesMap);
        if (entries.length > 0) {
            ctx.recent_detections = entries
                .sort(function(a,b){ return b[1].lastSeen - a[1].lastSeen; })
                .slice(0, 8)
                .map(function(e){ return {name: e[0], confidence: e[1].confidence}; });
        }
        if (ctx.environment || ctx.recent_detections) {
            fd.append('context', JSON.stringify(ctx));
        }

        dbg('📷 #' + S.frameScanCount + ' Gemini送信 (' + (analysis ? analysis.reason : 'no-model') + ')');
        var resp = await fetch('/api/v2/scan_classify.php', {method:'POST', body:fd});
        if (!resp.ok) { dbg('📷 HTTP ' + resp.status); return; }
        var respText = await resp.text();
        updateDataUsage(respText.length);
        var json = JSON.parse(respText);
        if (json.success && json.data && json.data.suggestions && json.data.suggestions.length > 0) {
            // Gemini 結果を MobileNet クラスに紐付けて学習
            if (typeof BioPrescreen !== 'undefined' && BioPrescreen.available && mobilenetClasses.length > 0) {
                BioPrescreen.learnFromGemini(mobilenetClasses, json.data.suggestions);
            }
            var shouldSaveFrame = false;
            json.data.suggestions.forEach(function(sug) {
                var isNewSpecies = !S.speciesMap[sug.name];
                addDetection(sug.name, sug.scientific_name || '', sug.confidence || 0.5, 'visual', sug.category || '', sug.note || '');
                if (isNewSpecies || (sug.confidence || 0) >= 0.80) shouldSaveFrame = true;
            });
            dbg('📷 ' + json.data.suggestions.length + '件検出!');
            if (shouldSaveFrame) saveKeyFrame(blob, json.data.suggestions[0], last);
        } else {
            dbg('📷 対象なし');
        }
    } catch(e) { dbg('📷 ERR: ' + e.message); }
}

function saveKeyFrame(blob, topSug, pos) {
    var sessionId = S.sessionId || 'unknown';
    var fd = new FormData();
    fd.append('frame', blob, 'keyframe.jpg');
    fd.append('session_id', sessionId);
    fd.append('taxon_name', topSug.name || '');
    fd.append('confidence', topSug.confidence || 0);
    if (pos) { fd.append('lat', pos.lat); fd.append('lng', pos.lng); }
    fetch('/api/v2/save_scan_frame.php', {method:'POST', body:fd})
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.data && data.data.frame_ref) {
                var name = topSug.name || '';
                if (S.pendingEvents) {
                    for (var i = S.pendingEvents.length - 1; i >= 0; i--) {
                        if (S.pendingEvents[i].taxon_name === name && !S.pendingEvents[i].frame_ref) {
                            S.pendingEvents[i].frame_ref = data.data.frame_ref;
                            break;
                        }
                    }
                }
                dbg('💾 キーフレーム保存: ' + name);
            }
        }).catch(function() {});
}

// ===== Bioacoustic Frequency Filter =====
function hasBirdFrequencyEnergy() {
    if (!S.analyser) return true;
    var data = new Uint8Array(S.analyser.frequencyBinCount);
    S.analyser.getByteFrequencyData(data);
    var sr = S.audioCtx.sampleRate;
    var binSize = sr / S.analyser.fftSize;

    var birdLo = Math.floor(2000 / binSize);
    var birdHi = Math.min(Math.ceil(8000 / binSize), data.length - 1);
    var birdE = 0;
    for (var i = birdLo; i <= birdHi; i++) birdE += data[i];
    birdE /= (birdHi - birdLo + 1);

    var lowHi = Math.min(Math.ceil(1000 / binSize), data.length - 1);
    var lowE = 0;
    for (var i = 0; i <= lowHi; i++) lowE += data[i];
    lowE /= (lowHi + 1);

    return birdE > 15 && lowE < birdE * 1.5;
}

// ===== Audio Recorder =====
function setupAudioRecorder() {
    if (!S.stream) return;
    var tracks = S.stream.getAudioTracks();
    if (tracks.length === 0) return;
    S.mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    if (!S.mime) return;

    var audioStream = new MediaStream(tracks);

    // AnalyserNode for frequency filter
    S.audioCtx = new AudioContext();
    var src = S.audioCtx.createMediaStreamSource(audioStream);
    S.analyser = S.audioCtx.createAnalyser();
    S.analyser.fftSize = 2048;
    src.connect(S.analyser);

    S.recorder = new MediaRecorder(audioStream, {mimeType: S.mime});
    S.chunks = [];
    S.recorder.ondataavailable = function(e) { if (e.data.size > 0) S.chunks.push(e.data); };
    S.recorder.onstop = function() {
        if (S.chunks.length === 0 || !S.active) return;
        var blob = new Blob(S.chunks, {type: S.mime});
        S.chunks = [];
        var passedFilter = hasBirdFrequencyEnergy();
        // 録音完了 → AudioContext を suspend（FFT演算停止で省電力）
        if (S.audioCtx && S.audioCtx.state === 'running') S.audioCtx.suspend();
        sendAudio(blob, passedFilter);
    };
    startAudioCycle();
}

function startAudioCycle() {
    if (!S.active || !S.recorder) return;
    if (S.analyzing || S._audioResuming) { S.recTimer = setTimeout(startAudioCycle, 1000); return; }
    setScanListenState('listening');
    var audioMs = getAdaptiveAudioMs();
    var doRecord = function() {
        S._audioResuming = false;
        if (!S.active) return;
        try {
            S.chunks = [];
            S.recorder.start();
            S.recTimer = setTimeout(function() {
                if (S.recorder && S.recorder.state === 'recording') S.recorder.stop();
            }, 3000);
        } catch(e) { S.recTimer = setTimeout(startAudioCycle, audioMs); }
    };
    if (S.audioCtx && S.audioCtx.state === 'suspended') {
        S._audioResuming = true;
        S.audioCtx.resume().then(doRecord).catch(function(e) {
            dbg('AudioCtx resume ERR: ' + e.message);
            doRecord();
        });
    } else {
        doRecord();
    }
}

async function sendAudio(blob, passedFreqFilter) {
    if (!S.active) return;
    S.analyzing = true;
    setScanListenState('analyzing');
    try {
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
        var fd = new FormData();
        fd.append('audio', blob, 'snippet' + (S.mime.indexOf('mp4') >= 0 ? '.mp4' : '.webm'));
        fd.append('lat', last ? last.lat : 35.0);
        fd.append('lng', last ? last.lng : 139.0);
        if (S.sensitivityLevel >= 2) fd.append('min_conf', '0.03');
        else if (S.sensitivityLevel >= 1) fd.append('min_conf', '0.05');
        fd.append('source_mode', 'field_scan');
        if (last && last.accuracy) fd.append('gps_accuracy', last.accuracy);
        if (passedFreqFilter) fd.append('archive_mode', '1');
        updateDataUsage(blob.size);
        S.audioScanCount++;
        document.getElementById('audio-count').textContent = S.audioScanCount;
        dbg('🎤 #' + S.audioScanCount + ' 送信中...');
        var resp = await fetch('/api/v2/analyze_audio.php', {method:'POST', body:fd});
        if (!resp.ok) { dbg('🎤 HTTP ' + resp.status); return; }
        var respText = await resp.text();
        updateDataUsage(respText.length);
        var json = JSON.parse(respText);
        var displayThreshold = S.sensitivityLevel >= 2 ? 0.15 : S.sensitivityLevel >= 1 ? 0.25 : 0.40;
        if (json.success && json.data && json.data.detections && json.data.detections.length > 0) {
            var filtered = json.data.detections.filter(function(d) { return d.confidence >= displayThreshold; });
            filtered.forEach(function(d) {
                var displayName = d.japanese_name || d.common_name || d.scientific_name;
                addDetection(displayName, d.scientific_name, d.confidence, 'audio', 'bird');
            });
            S.audioEmptyStreak = filtered.length > 0 ? 0 : S.audioEmptyStreak + 1;
            if (filtered.length > 0) {
                setScanListenState('detected');
                setTimeout(function() { setScanListenState('listening'); }, 2000);
            } else {
                setScanListenState('listening');
            }
            dbg('🎤 ' + json.data.detections.length + '件 (表示' + filtered.length + ')');
        } else {
            S.audioEmptyStreak++;
            setScanListenState('listening');
            dbg('🎤 検出なし');
        }
    } catch(e) { dbg('🎤 ERR: ' + e.message); setScanListenState('listening'); } finally {
        S.analyzing = false;
        if (S.active) {
            // アダプティブ: 空振り続きなら次のサイクルまで待つ
            var waitMs = getAdaptiveAudioMs() - 3000;
            if (waitMs > 0) {
                S.recTimer = setTimeout(startAudioCycle, waitMs);
            } else {
                startAudioCycle();
            }
        }
    }
}

// ライブスキャン用リスニング状態
function setScanListenState(state) {
    var el = document.getElementById('s-mic');
    if (!el) return;
    switch(state) {
        case 'listening': el.textContent = '🎤'; el.style.background = 'rgba(34,197,94,0.2)'; el.style.color = '#4ade80'; break;
        case 'analyzing': el.textContent = '🔍'; el.style.background = 'rgba(251,191,36,0.2)'; el.style.color = '#fbbf24'; break;
        case 'detected':  el.textContent = '🐦'; el.style.background = 'rgba(96,165,250,0.2)'; el.style.color = '#60a5fa'; break;
    }
}

// ===== Detection =====
function addDetection(name, sci, conf, source, category, note) {
    S.totalDet++;
    if (source === 'audio') S.audioDet++; else S.visualDet++;

    var isNew = !S.speciesMap[name];
    if (isNew) {
        S.speciesMap[name] = {count:0, confidence:0, source:source, category:category||'', note:note||'', firstSeen:Date.now(), lastSeen:Date.now()};
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    }
    S.speciesMap[name].count++;
    S.speciesMap[name].confidence = Math.max(S.speciesMap[name].confidence, conf);
    S.speciesMap[name].lastSeen = Date.now();
    if (note && !S.speciesMap[name].note) S.speciesMap[name].note = note;

    // 時系列ログに追記（ドロワーで後から見返せる）
    S.detectionLog.push({
        name: name, sci: sci, conf: conf, source: source,
        note: note || '', isNew: isNew,
        time: Math.floor((Date.now() - S.startTime) / 1000),
    });
    updateLogDrawerBadge();

    updateCounts();
    showDetBanner(name, sci, conf, source, note);
    addMapMarker(name, source);
    updateSpeciesList();

    // リアルタイムでサーバーに送信（デジタルツインに蓄積）
    sendDetectionToServer(name, sci, conf, source);

    // 音声ガイド（検出とアンビエントを交互に。連続発話防止）
    if (VoiceGuide.isEnabled()) {
        S._vgCount = S._vgCount || {};
        S._vgCount[name] = (S._vgCount[name] || 0) + 1;
        var cnt = S._vgCount[name];
        var isFirstDet = cnt === 1;
        // 発話中・再生中はスキップ（キュー詰まり防止）
        try { if (VoiceGuide.isSpeaking()) return; } catch(e) {}
        // 前回の発話から20秒以内はスキップ（アンビエントに譲る）
        var sinceLast = Date.now() - (S._lastDetVoiceTime || 0);
        if (sinceLast < 20000 && !isFirstDet) return;
        if (isFirstDet || cnt % 3 === 0) {
            S._lastDetVoiceTime = Date.now();
            S._lastVoiceTime = Date.now();
            _fetchVoiceGuide(name, sci, conf, cnt, isFirstDet);
        }
    }
}

function postScanSummary(speciesCount, durationMin) {
    if (speciesCount === 0 && S.routePoints.length === 0) return;

    var speciesList = Object.entries(S.speciesMap).map(function(e) {
        return { name: e[0], count: e[1].count, confidence: e[1].confidence, source: e[1].source };
    });

    var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
    var envSummary = S.envHistory.length > 0 ? S.envHistory[0] : null;

    var summaryPayload = {
        scan_mode: 'live-scan',
        duration_min: durationMin,
        species_count: speciesCount,
        total_detections: S.totalDet,
        audio_detections: S.audioDet,
        visual_detections: S.visualDet,
        gps_points: S.routePoints.length,
        species: speciesList,
        environment: envSummary,
        session_id: S.serverSessionId || S.sessionId,
        lat: last ? last.lat : null,
        lng: last ? last.lng : null,
    };

    fetch('/api/v2/scan_summary.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify(summaryPayload)
    }).then(function(r) {
        if (r.status === 401) {
            localStorage.setItem('ikimon_pending_summary', JSON.stringify(summaryPayload));
            dbg('⚠️ サマリー送信失敗（認証切れ）— 再ログイン後にリトライ');
        }
        return r.json();
    }).catch(function() {
        localStorage.setItem('ikimon_pending_summary', JSON.stringify(summaryPayload));
    });
}

// 個別検出 → pendingEvents に蓄積（30秒バッチで送信。即時POSTは省電力のため廃止）
function sendDetectionToServer(name, sci, conf, source) {
    // ローカルに蓄積（30秒ごとの flushEvents で一括送信）
    if (!S.pendingEvents) S.pendingEvents = [];
    var det = S.speciesMap[name] || {};
    var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
    var evt = {
        type: source === 'audio' ? 'audio' : 'visual',
        taxon_name: name,
        scientific_name: sci,
        confidence: conf,
        category: det.category || '',
        lat: last ? last.lat : null,
        lng: last ? last.lng : null,
        timestamp: new Date().toISOString(),
        model: source === 'audio' ? 'birdnet-v2.4' : 'gemini-vision',
    };
    if (S.envHistory.length > 0) {
        var env = S.envHistory[0];
        evt.environment_snapshot = {
            habitat: env.habitat||'', vegetation: env.vegetation||'',
            ground: env.ground||'', water: env.water||'',
            canopy_cover: env.canopy_cover||'', disturbance: env.disturbance||'',
            description: env.description||'', timestamp: env.timestamp||''
        };
    }
    S.pendingEvents.push(evt);
}

// Haversine distance
function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcDistance(points) {
    var total = 0;
    for (var i = 1; i < points.length; i++) {
        var R = 6371000;
        var dLat = (points[i].lat - points[i-1].lat) * Math.PI / 180;
        var dLng = (points[i].lng - points[i-1].lng) * Math.PI / 180;
        var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
                Math.cos(points[i-1].lat*Math.PI/180)*Math.cos(points[i].lat*Math.PI/180)*
                Math.sin(dLng/2)*Math.sin(dLng/2);
        total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    return Math.round(total);
}

function updateLogDrawerBadge() {
    if (S.logDrawerOpen) {
        updateLogDrawer();
        return;
    }
    var badge = document.getElementById('log-badge');
    if (badge) {
        badge.style.display = '';
        badge.textContent = S.detectionLog.length;
    }
}

function updateLogDrawer() {
    var list = document.getElementById('det-log-list');
    var empty = document.getElementById('det-log-empty');
    if (!list) return;

    var grouped = {};
    S.detectionLog.slice().reverse().forEach(function(d) {
        if (!grouped[d.name]) grouped[d.name] = {latest: d, count: 0};
        grouped[d.name].count++;
    });

    var html = '';
    var entries = S.detectionLog.slice().reverse();
    entries.forEach(function(d) {
        var sec = d.time;
        var timeStr = sec < 60 ? sec + 's' : Math.floor(sec/60) + 'm' + (sec%60) + 's';
        var confPct = Math.round(d.conf * 100);
        var confColor = d.conf >= 0.7 ? '#4ade80' : d.conf >= 0.4 ? '#fbbf24' : '#9ca3af';
        var srcIcon = d.source === 'audio' ? '🎤' : '📷';
        var newBadge = d.isNew ? '<span style="font-size:9px;padding:1px 5px;border-radius:5px;background:rgba(34,197,94,0.25);color:#4ade80;font-weight:700;margin-left:4px">NEW</span>' : '';
        var note = d.note ? '<div style="font-size:10px;color:#9ca3af;margin-top:2px;line-height:1.4">' + d.note.substring(0, 80) + (d.note.length > 80 ? '…' : '') + '</div>' : '';
        html += '<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:10px;border-left:3px solid ' + confColor + '">'
            + '<div style="display:flex;align-items:center;gap:6px">'
            + '<span style="font-size:10px;color:#666;font-family:monospace;min-width:32px">' + timeStr + '</span>'
            + '<span style="font-size:10px">' + srcIcon + '</span>'
            + '<span style="font-size:13px;font-weight:700;color:#fff">' + d.name + '</span>'
            + newBadge
            + '<span style="margin-left:auto;font-size:10px;color:' + confColor + ';font-weight:700">' + confPct + '%</span>'
            + '</div>'
            + (d.sci ? '<div style="font-size:10px;color:#6b7280;font-style:italic;margin-top:1px;padding-left:52px">' + d.sci + '</div>' : '')
            + note
            + '</div>';
    });

    list.innerHTML = html;
    empty.style.display = entries.length === 0 ? '' : 'none';
    list.style.display = entries.length === 0 ? 'none' : '';
}

function updateCounts() {
    var spCount = Object.keys(S.speciesMap).length;
    document.getElementById('sp-count').textContent = spCount;
    document.getElementById('sp-count-top').textContent = spCount;
    var ds = document.getElementById('drive-species');
    if (ds) ds.textContent = spCount + '種検出 · ' + S.totalDet + '回';
}

function showDetBanner(name, sci, conf, source, note) {
    var b = document.getElementById('det-banner');
    var isNew = S.speciesMap[name] && S.speciesMap[name].count === 1;
    var isAudio = source === 'audio';
    var cat = (S.speciesMap[name] && S.speciesMap[name].category) || '';
    var isVegRecord = cat === 'plant' && /広葉|落葉|常緑|針葉|イネ科|キク科|シダ|つる性|草本|低木|高木/.test(name);

    // 信頼度バッジ
    var badge = document.getElementById('det-conf-badge');
    var confPct = Math.round(conf * 100);
    if (conf >= 0.70) {
        badge.textContent = '確定';
        badge.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700;background:rgba(34,197,94,0.3);color:#4ade80';
        b.style.borderLeft = '4px solid #4ade80';
    } else if (conf >= 0.40) {
        badge.textContent = '推定';
        badge.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700;background:rgba(251,191,36,0.3);color:#fbbf24';
        b.style.borderLeft = '4px solid #fbbf24';
    } else {
        badge.textContent = '候補';
        badge.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700;background:rgba(255,255,255,0.1);color:#999';
        b.style.borderLeft = '4px solid #666';
    }

    var nameHtml = name;
    if (isNew) nameHtml += ' <span style="font-size:11px;padding:1px 6px;border-radius:6px;background:rgba(34,197,94,0.3);color:#4ade80;font-weight:700">NEW!</span>';
    if (isVegRecord) nameHtml += ' <span style="font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(34,197,94,0.15);color:#86efac;font-weight:600">🌳 植生記録</span>';
    document.getElementById('det-name').innerHTML = nameHtml;
    document.getElementById('det-sci').textContent = sci || '';
    document.getElementById('det-meta').textContent = (isAudio ? '🎤 音声' : '📷 カメラ') + ' · ' + confPct + '%';
    b.style.display = '';

    // ドライブモード: 検出時はステータスを隠してバナーを目立たせ、5秒後に戻す
    if (S.mode === 'car') {
        var ds = document.getElementById('drive-status');
        if (ds) ds.style.opacity = '0';
        clearTimeout(S._driveRestoreTimer);
        S._driveRestoreTimer = setTimeout(function() { if (ds) ds.style.opacity = '1'; }, 5000);
    }

    // note（AI特徴1文）を即座に表示 — OmoikaneDB待ち不要
    var cardInfo = document.getElementById('det-card-info');
    if (note) {
        document.getElementById('det-card-trait').textContent = note;
        document.getElementById('det-card-habitat').textContent = '';
        cardInfo.style.display = '';
    } else {
        cardInfo.style.display = 'none';
    }

    // OmoikaneDB から詳細を非同期で上書き（noteよりリッチな情報）
    fetchScanSpeciesCard(name, sci).then(function(card) {
        if (!card) return;
        var trait = card.morphological_traits || card.notes || '';
        if (trait.length > 80) trait = trait.substring(0, 80) + '...';
        if (trait) document.getElementById('det-card-trait').textContent = trait;
        document.getElementById('det-card-habitat').textContent = card.habitat ? '🌿 ' + card.habitat : '';
        cardInfo.style.display = '';
    });

    // 貢献ポイント（新種のみ）
    if (isNew) {
        S.totalPoints += 10;
        showScanToast('+10pt 🌱');
    }

    // 消さない — 次の検出まで表示し続ける
    clearTimeout(S._bannerTimer);
}

// 種カード取得（キャッシュ付き）
async function fetchScanSpeciesCard(name, sciName) {
    var key = sciName || name;
    if (S.speciesCardCache[key]) return S.speciesCardCache[key];
    try {
        var params = new URLSearchParams();
        if (name) params.set('name', name);
        if (sciName) params.set('scientific_name', sciName);
        var resp = await fetch('/api/v2/species_card.php?' + params.toString());
        if (!resp.ok) return null;
        var data = await resp.json();
        if (data.success && data.data) {
            S.speciesCardCache[key] = data.data;
            return data.data;
        }
    } catch(e) {}
    return null;
}

// ライブスキャン用トースト
function showScanToast(msg) {
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:100;padding:6px 16px;border-radius:12px;background:rgba(16,185,129,0.9);color:white;font-size:13px;font-weight:700;animation:scanFade 2.5s ease forwards;pointer-events:none';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 2500);
}

function updateSpeciesList() {
    var entries = Object.entries(S.speciesMap);
    var hasAny = entries.length > 0;
    document.getElementById('species-empty').style.display = hasAny ? 'none' : '';

    var visual = entries.filter(function(e) { return e[1].source === 'visual'; });
    var audio = entries.filter(function(e) { return e[1].source === 'audio'; });

    // 最新検出順にソート
    visual.sort(function(a, b) { return b[1].lastSeen - a[1].lastSeen; });
    audio.sort(function(a, b) { return b[1].lastSeen - a[1].lastSeen; });

    var now = Date.now();

    function renderItem(e) {
        var name = e[0], d = e[1];
        var age = now - d.lastSeen;
        var isRecent = age < 30000;
        var confPct = Math.round(d.confidence * 100);
        var confColor = d.confidence >= 0.7 ? 'color:#4ade80' : d.confidence >= 0.4 ? 'color:#fbbf24' : 'color:#999';
        var confLabel = d.confidence >= 0.7 ? '確定' : d.confidence >= 0.4 ? '推定' : '候補';
        var bg = isRecent ? 'background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3)' : 'background:rgba(255,255,255,0.05)';
        var badge = isRecent ? '<span style="font-size:9px;padding:1px 5px;border-radius:6px;background:rgba(34,197,94,0.3);color:#4ade80;font-weight:700;margin-left:4px">NOW</span>' : '';
        var isVeg = d.category === 'plant' && /広葉|落葉|常緑|針葉|イネ科|キク科|シダ|つる性|草本|低木|高木/.test(name);
        var vegBadge = isVeg ? ' <span style="font-size:8px;padding:1px 4px;border-radius:4px;background:rgba(34,197,94,0.1);color:#86efac">🌳植生</span>' : '';
        var timeStr = age < 60000 ? 'たった今' : Math.floor(age / 60000) + '分前';
        var cardId = 'sp-card-' + name.replace(/[^a-zA-Z0-9]/g, '_');
        var noteHtml = d.note ? '<div style="font-size:10px;color:#a3e635;margin-top:1px">💡 ' + d.note + '</div>' : '';
        return '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px;margin-bottom:4px;border-radius:10px;' + bg + '">'
            + '<div style="flex:1">'
            + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">' + name + badge + vegBadge
            + ' <span style="font-size:9px;padding:1px 5px;border-radius:6px;' + confColor.replace('color:', 'color:') + ';background:rgba(255,255,255,0.06)">' + confLabel + '</span></div>'
            + noteHtml
            + '<div id="' + cardId + '" style="font-size:10px;color:#9ca3af;margin-top:2px;line-height:1.3"></div>'
            + '</div>'
            + '<div style="text-align:right;shrink:0">'
            + '<span style="font-size:10px;color:#666">' + timeStr + '</span><br>'
            + '<span style="font-size:11px;' + confColor + '">' + confPct + '% ×' + d.count + '</span></div></div>';
    }

    // カメラセクション
    document.getElementById('visual-section').style.display = visual.length ? '' : 'none';
    document.getElementById('visual-count').textContent = visual.length + '種';
    document.getElementById('visual-list').innerHTML = visual.map(renderItem).join('');

    // 音声セクション
    document.getElementById('audio-section').style.display = audio.length ? '' : 'none';
    document.getElementById('audio-sp-count').textContent = audio.length + '種';
    document.getElementById('audio-list').innerHTML = audio.map(renderItem).join('');

    // セッションサマリー更新
    if (hasAny) {
        document.getElementById('session-summary').style.display = '';
        document.getElementById('sum-species').textContent = entries.length;
        document.getElementById('sum-visual').textContent = visual.length;
        document.getElementById('sum-audio').textContent = audio.length;
    }

    // 種リスト項目に種カード情報を非同期注入
    entries.forEach(function(e) {
        var name = e[0];
        var cardId = 'sp-card-' + name.replace(/[^a-zA-Z0-9]/g, '_');
        var el = document.getElementById(cardId);
        if (el && !el.dataset.loaded) {
            el.dataset.loaded = '1';
            fetchScanSpeciesCard(name, null).then(function(card) {
                if (!card || !el) return;
                var text = card.morphological_traits || card.notes || '';
                if (text.length > 50) text = text.substring(0, 50) + '...';
                if (card.habitat) text = '🌿' + card.habitat + (text ? ' · ' + text : '');
                el.textContent = text;
            });
        }
    });
}

function setSensor(id, on) {
    var el = document.getElementById('s-' + id);
    if (el) {
        el.style.background = on ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)';
        el.style.color = on ? '#4ade80' : '#666';
    }
}

// ===== Environment Scan =====
async function envScan() {
    if (!S.active) return;
    // 前回スキャン位置から50m以上移動した場合のみ実行（静止中は同じ環境なので省電力）
    var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
    if (S._lastEnvPos && last) {
        var d = haversine(S._lastEnvPos.lat, S._lastEnvPos.lng, last.lat, last.lng);
        if (d < 50) return;
    }
    if (last) S._lastEnvPos = {lat: last.lat, lng: last.lng};
    try {
        var v = document.getElementById('cam');
        var c = document.getElementById('cap');
        if (!v.videoWidth) return;
        c.width = Math.min(v.videoWidth, 512);
        c.height = Math.round(c.width * v.videoHeight / v.videoWidth);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

        var blob = await new Promise(function(r) { c.toBlob(r, 'image/jpeg', 0.6); });
        updateDataUsage(blob.size);
        var fd = new FormData();
        fd.append('photo', blob, 'env.jpg');
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
        if (last) { fd.append('lat', last.lat); fd.append('lng', last.lng); }

        var resp = await fetch('/api/v2/env_scan.php', {method:'POST', body:fd});
        if (!resp.ok) return;
        var respText = await resp.text();
        updateDataUsage(respText.length);
        var json = JSON.parse(respText);
        if (json.success && json.data && json.data.environment) {
            var env = json.data.environment;
            S.envHistory.unshift(env);
            if (S.envHistory.length > 20) S.envHistory.pop();

            // カメラ上の環境パネル更新
            var panel = document.getElementById('env-panel');
            var text = '';
            if (env.habitat) text += env.habitat;
            if (env.vegetation) text += '<br>' + env.vegetation;
            if (env.description) text = env.description;
            document.getElementById('env-text').innerHTML = text;
            panel.style.display = '';

            // 環境ログタブ更新
            updateEnvLog();

            // マップにハビタットマーカー追加
            if (S.minimap && last) {
                var el = document.createElement('div');
                el.style.cssText = 'font-size:14px;opacity:0.6';
                el.textContent = '🌳';
                el.title = env.description || env.habitat || '';
                new maplibregl.Marker({element:el}).setLngLat([last.lng, last.lat]).addTo(S.minimap);
            }
        }
    } catch(e) { console.warn('Env scan error:', e); }
}

function updateEnvLog() {
    document.getElementById('env-empty').style.display = S.envHistory.length ? 'none' : '';
    document.getElementById('env-log').innerHTML = S.envHistory.map(function(env) {
        var time = env.timestamp ? new Date(env.timestamp).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'}) : '';
        var tags = [];
        if (env.habitat) tags.push('<span style="background:rgba(34,197,94,0.2);color:#4ade80;padding:1px 6px;border-radius:8px">' + env.habitat + '</span>');
        if (env.vegetation) tags.push('<span style="background:rgba(59,130,246,0.2);color:#60a5fa;padding:1px 6px;border-radius:8px">' + env.vegetation + '</span>');
        if (env.ground) tags.push('<span style="background:rgba(245,158,11,0.2);color:#fbbf24;padding:1px 6px;border-radius:8px">' + env.ground + '</span>');
        if (env.water && env.water !== 'なし') tags.push('<span style="background:rgba(59,130,246,0.3);color:#93c5fd;padding:1px 6px;border-radius:8px">💧' + env.water + '</span>');
        return '<div style="padding:8px;margin-bottom:6px;background:rgba(255,255,255,0.05);border-radius:8px">'
            + '<div style="color:#999;font-size:10px;margin-bottom:4px">' + time + '</div>'
            + '<div style="display:flex;flex-wrap:wrap;gap:4px">' + tags.join('') + '</div>'
            + (env.description ? '<div style="color:#aaa;font-size:11px;margin-top:4px">' + env.description + '</div>' : '')
            + '</div>';
    }).join('');
}

// ===== Map =====
function initMap(lat, lng) {
    if (S.minimap) return;
    S.minimap = new maplibregl.Map({
        container: 'minimap',
        style: { version:8, sources: { osm: { type:'raster', tiles:['https://tile.openstreetmap.jp/styles/osm-bright-ja/{z}/{x}/{y}.png'], tileSize:256 } }, layers:[{id:'osm',type:'raster',source:'osm'}] },
        center: [lng, lat], zoom: 16,
    });
    S.minimap.on('load', function() {
        S.minimap.addSource('route', { type:'geojson', data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}} });
        S.minimap.addLayer({ id:'route', type:'line', source:'route', paint:{'line-color':'#4ade80','line-width':3} });
        var el = document.createElement('div');
        el.style.cssText = 'width:12px;height:12px;background:#3b82f6;border:2px solid #fff;border-radius:50%';
        S.posMarker = new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(S.minimap);
    });
}

function updateMapRoute() {
    if (!S.minimap || !S.minimap.getSource('route')) return;
    var coords = S.routePoints.map(function(p) { return [p.lng, p.lat]; });
    if (coords.length > 1) S.minimap.getSource('route').setData({type:'Feature',geometry:{type:'LineString',coordinates:coords}});
    var last = coords[coords.length - 1];
    if (S.posMarker) S.posMarker.setLngLat(last);
    S.minimap.easeTo({center:last, duration:500});
}

function addMapMarker(name, source) {
    if (!S.minimap || S.routePoints.length === 0) return;
    var last = S.routePoints[S.routePoints.length - 1];
    var el = document.createElement('div');
    el.style.cssText = 'font-size:18px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));transition:transform 0.3s';
    el.textContent = source === 'audio' ? '🐦' : '🌿';
    el.title = name;
    el.style.transform = 'scale(0)';
    setTimeout(function() { el.style.transform = 'scale(1)'; }, 50);
    new maplibregl.Marker({element:el}).setLngLat([last.lng, last.lat]).addTo(S.minimap);
}

// ===== Tabs =====
document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.style.background='rgba(255,255,255,0.05)'; b.style.color='#666'; b.classList.remove('active'); });
        this.style.background = 'rgba(255,255,255,0.15)'; this.style.color = '#fff'; this.classList.add('active');
        var tab = this.getAttribute('data-tab');
        document.getElementById('tab-map').style.display = tab === 'map' ? '' : 'none';
        document.getElementById('tab-log').style.display = tab === 'log' ? '' : 'none';
        document.getElementById('tab-species').style.display = tab === 'species' ? '' : 'none';
        document.getElementById('tab-env').style.display = tab === 'env' ? '' : 'none';
        if (tab === 'log') {
            document.getElementById('log-badge').style.display = 'none';
            S.logDrawerOpen = true;
        } else {
            S.logDrawerOpen = false;
        }
    });
});

// ===== Mode selection =====
document.querySelectorAll('.scan-mode-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        S.mode = this.getAttribute('data-mode');
        document.querySelectorAll('.scan-mode-btn').forEach(function(b) {
            b.style.background = 'rgba(255,255,255,0.05)';
            b.style.borderColor = 'transparent';
            b.querySelector('div:nth-child(2)').style.color = '#888';
        });
        this.style.background = 'rgba(16,185,129,0.15)';
        this.style.borderColor = '#10b981';
        this.querySelector('div:nth-child(2)').style.color = '#10b981';
        // 説明文切替
        document.getElementById('mode-desc-walk').style.display = S.mode === 'walk' ? '' : 'none';
        document.getElementById('mode-desc-bike').style.display = S.mode === 'bike' ? '' : 'none';
        document.getElementById('mode-desc-car').style.display = S.mode === 'car' ? '' : 'none';
    });
});

// ===== Capture button (walk mode: take photo → observation post) =====
document.getElementById('btn-capture').addEventListener('click', async function() {
    try {
        var v = document.getElementById('cam');
        var c = document.getElementById('cap');
        if (!v.videoWidth) return;
        // フル解像度で撮影
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);

        var blob = await new Promise(function(r) { c.toBlob(r, 'image/jpeg', 0.9); });
        S.capturedPhotos.push(blob);

        dbg('📸 撮影 #' + S.capturedPhotos.length);
        if (navigator.vibrate) navigator.vibrate(50);

        // 3枚溜まったら自動投稿、または1枚でも即送信
        if (S.capturedPhotos.length >= 3) {
            uploadCapturedPhotos();
        } else {
            // 5秒後に未送信分を送信
            clearTimeout(S._uploadTimer);
            S._uploadTimer = setTimeout(uploadCapturedPhotos, 5000);
        }
    } catch(e) { dbg('📸 ERR: ' + e.message); }
});

async function uploadCapturedPhotos() {
    if (S.capturedPhotos.length === 0) return;
    var photos = S.capturedPhotos.slice();
    S.capturedPhotos = [];

    var fd = new FormData();
    photos.forEach(function(blob, i) {
        fd.append('photos[]', blob, 'capture_' + i + '.jpg');
    });

    var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
    if (last) { fd.append('lat', last.lat); fd.append('lng', last.lng); }
    fd.append('source', 'live-scan-capture');

    try {
        var resp = await fetch('/api/v2/quick_post.php', {method: 'POST', body: fd});
        var json = await resp.json();
        dbg(json.success ? '📸 投稿完了!' : '📸 投稿失敗');
    } catch(e) { dbg('📸 送信ERR'); }
}

// ===== Consent toggle =====
// 同意チェック（localStorage で記憶）
(function() {
    var cb = document.getElementById('consent-check');
    var btn = document.getElementById('btn-start');
    function updateBtn(checked) {
        if (checked) {
            btn.disabled = false;
            btn.className = 'w-full py-5 bg-green-600 hover:bg-green-700 rounded-2xl text-lg font-bold active:scale-95 transition';
        } else {
            btn.disabled = true;
            btn.className = 'w-full py-5 bg-green-600/50 text-green-300 cursor-not-allowed rounded-2xl text-lg font-bold transition';
        }
    }
    var panel = document.getElementById('settings-panel');
    if (localStorage.getItem('ikimon_scan_consent') === '1') {
        cb.checked = true;
        updateBtn(true);
        if (panel) panel.removeAttribute('open');
    }
    cb.addEventListener('change', function() {
        localStorage.setItem('ikimon_scan_consent', this.checked ? '1' : '0');
        updateBtn(this.checked);
    });
})();

// ===== Species Prediction (ページロード時) =====
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(pos) {
        fetch('/api/v2/predict_species.php?lat=' + pos.coords.latitude + '&lng=' + pos.coords.longitude + '&limit=5')
            .then(function(r) { return r.json(); })
            .then(function(j) {
                if (!j.success || !j.data || !j.data.predictions || j.data.predictions.length === 0) return;
                var d = j.data;
                if (d.environment) {
                    document.getElementById('predict-env-badge').textContent = (d.environment.icon || '') + ' ' + (d.environment.label || '');
                }
                var html = d.predictions.map(function(p) {
                    var pct = Math.round(p.probability * 100);
                    var barColor = pct >= 70 ? '#4ade80' : pct >= 40 ? '#fbbf24' : '#93c5fd';
                    var note = p.note || '';
                    if (note.length > 50) note = note.substring(0, 50) + '...';
                    var badge = p.observed_nearby ? '<span style="font-size:9px;padding:1px 5px;border-radius:6px;background:rgba(34,197,94,0.2);color:#4ade80">実績あり</span>' : '';
                    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'
                        + '<div style="flex:1">'
                        + '<div style="font-size:13px;font-weight:700;color:#e0e7ff">' + p.name + ' ' + badge + '</div>'
                        + (note ? '<div style="font-size:10px;color:#9ca3af;margin-top:1px">' + note + '</div>' : '')
                        + '</div>'
                        + '<div style="text-align:right">'
                        + '<div style="font-size:12px;font-weight:800;color:' + barColor + '">' + pct + '%</div>'
                        + '</div></div>';
                }).join('');
                document.getElementById('predict-list').innerHTML = html;
                document.getElementById('predict-section').classList.remove('hidden');
            }).catch(function() {});
    }, function() {}, {enableHighAccuracy: false, timeout: 5000});
}

// ===== Sensitivity toggle =====
var _sensSlider = document.getElementById('sensitivity-slider');
if (_sensSlider) _sensSlider.addEventListener('input', function() {
    S.sensitivityLevel = parseInt(this.value);
    var descs = ['通常: 信頼度40%以上を表示', '高感度: 信頼度25%以上を表示', '超高感度: 信頼度15%以上（誤検出が増えます）'];
    document.getElementById('sensitivity-desc').textContent = descs[S.sensitivityLevel] || descs[0];
});

// ===== Buttons =====
document.getElementById('btn-start').addEventListener('click', startScan);
var _stopBtn = document.getElementById('btn-stop');
_stopBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); stopScan(); });
_stopBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); stopScan(); }, {passive: false});

// ページ読込時に未送信データを自動再送
retryScanPending();

// 未送信サマリーのリトライ
(function retryPendingSummary() {
    var raw = localStorage.getItem('ikimon_pending_summary');
    if (!raw) return;
    try {
        var payload = JSON.parse(raw);
        fetch('/api/v2/scan_summary.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        }).then(function(r) {
            if (r.ok) {
                localStorage.removeItem('ikimon_pending_summary');
                dbg('✅ Pending summary retried successfully');
            }
        }).catch(function() {});
    } catch(e) {}
})();

// オンライン復帰時に自動リトライ
window.addEventListener('online', function() {
    dbg('🔄 Online detected, retrying pending...');
    setTimeout(retryScanPending, 1500);
});

// タブ復帰時にもリトライ
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && navigator.onLine) {
        var key = 'ikimon_scan_pending';
        var pending = JSON.parse(localStorage.getItem(key) || '[]');
        if (pending.length > 0) {
            dbg('🔄 Tab visible, retrying pending...');
            retryScanPending();
        }
    }
});

// ===== Voice Guide helpers =====
function selectVgOutput(o) {
    VoiceGuide.setOutput(o);
    document.querySelectorAll('.vg-output-btn').forEach(function(b) {
        var on = b.dataset.output === o;
        b.classList.toggle('active', on);
        b.style.borderColor = on ? '#3b82f6' : 'transparent';
        b.style.background = on ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)';
        b.style.color = on ? '#93c5fd' : '#9ca3af';
    });
}
function selectVgSpeaker(s) {
    VoiceGuide.setSpeaker(s);
    document.querySelectorAll('.vg-speaker-btn').forEach(function(b) {
        var on = b.dataset.speaker === s;
        b.classList.toggle('active', on);
        b.style.borderColor = on ? '#8b5cf6' : 'transparent';
        b.style.background = on ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.05)';
        b.style.color = on ? '#c4b5fd' : '#9ca3af';
    });
    var previewMap = { auto: 'auto', mochiko: 'mochiko', ryusei: 'ryusei', zundamon: 'zundamon' };
    if (previewMap[s]) {
        VoiceGuide.playPreview('/assets/audio/' + previewMap[s] + '_preview.wav');
    }
}

async function _fetchVoiceGuide(name, sci, conf, count, isFirst) {
    try {
        var p = new URLSearchParams();
        p.set('name', name || '');
        p.set('scientific_name', sci || '');
        p.set('confidence', conf);
        p.set('detection_count', count || 1);
        p.set('is_first_today', isFirst ? '1' : '0');
        p.set('voice_mode', VoiceGuide.getVoiceMode());
        p.set('transport_mode', S.mode || 'walk');
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
        if (last) { p.set('lat', last.lat); p.set('lng', last.lng); }
        var r = await fetch('/api/v2/voice_guide.php?' + p.toString());
        if (!r.ok) return;
        var j = await r.json();
        if (j.success && j.data) {
            S._lastVoiceTime = Date.now();
            var vs = document.getElementById('drive-voice-status');
            if (j.data.audio_url) {
                if (vs) vs.textContent = '🔊 ' + (j.data.guide_text || name).substring(0, 20) + '...';
                VoiceGuide.announceAudio(j.data.audio_url);
            } else if (j.data.guide_text) {
                if (vs) vs.textContent = '🔊 ' + j.data.guide_text.substring(0, 20) + '...';
                VoiceGuide.announce(j.data.guide_text);
            }
        }
    } catch(e) { dbg('🔊 detGuide ERR: ' + e.message); }
}

// アンビエントコメンタリー — GPS更新トリガー方式（setTimeoutはスリープで凍結されるため不使用）
// GPS更新(handleGpsPosition)やカメラキャプチャ時にtryAmbient()を呼ぶ
function tryAmbient() {
    if (!S.active || !VoiceGuide.isEnabled()) return;
    if (S._ambientFetching) return;
    var since = Date.now() - (S._lastVoiceTime || 0);
    // speakingでも20秒経ったら強制リセット（AudioContextのonended未発火対策）
    var isBusy = false;
    try { isBusy = VoiceGuide.isSpeaking(); } catch(e) {}
    if (isBusy && since < 20000) return;
    if (isBusy) { try { VoiceGuide.stop(); } catch(e) {} dbg('🔊 speaking強制リセット'); }
    if (since < 20000) return;
    _fetchAmbientNow();
}

async function _fetchAmbientNow() {
    S._ambientFetching = true;
    try {
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length-1] : null;
        var names = Object.keys(S.speciesMap).slice(0, 5).join(',');
        var min = Math.floor((Date.now() - S.startTime) / 60000);
        var p = new URLSearchParams();
        p.set('mode', 'ambient');
        p.set('lat', last ? last.lat : 34.7);
        p.set('lng', last ? last.lng : 137.7);
        p.set('detected_species', names);
        p.set('elapsed_min', min);
        p.set('voice_mode', VoiceGuide.getVoiceMode());
        p.set('transport_mode', S.mode || 'walk');
        p.set('session_count', S._ambientCount || 0);
        S._ambientCount = (S._ambientCount || 0) + 1;
        dbg('🔊 API #' + S._ambientCount);
        var vs = document.getElementById('drive-voice-status');
        if (vs) vs.textContent = '🔊 ガイド取得中...';
        var r = await fetch('/api/v2/voice_guide.php?' + p.toString());
        if (!r.ok) { dbg('🔊 err ' + r.status); if (vs) vs.textContent = '⚠️ 通信エラー'; S._ambientFetching = false; return; }
        var j = await r.json();
        if (j.success && j.data) {
            S._lastVoiceTime = Date.now();
            if (vs) vs.textContent = '🔊 ' + (j.data.guide_text || '').substring(0, 20) + '...';
            if (j.data.audio_url) VoiceGuide.announceAudio(j.data.audio_url);
            else if (j.data.guide_text) VoiceGuide.announce(j.data.guide_text);
        }
    } catch(e) { dbg('🔊 ambient ERR: ' + e.message); }
    S._ambientFetching = false;
}

// 音声ガイド: イベントリスナー登録（CSP nonce対応 — onchange/onclick は CSP でブロックされる）
document.addEventListener('DOMContentLoaded', function() {
    var vgToggle = document.getElementById('voice-guide-toggle');
    var vgSettings = document.getElementById('vg-settings');
    if (vgToggle) {
        vgToggle.addEventListener('change', function() {
            try { VoiceGuide.setEnabled(this.checked); } catch(e) {}
            if (vgSettings) vgSettings.style.display = this.checked ? 'block' : 'none';
        });
    }
    document.querySelectorAll('.vg-output-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { selectVgOutput(this.dataset.output); });
    });
    document.querySelectorAll('.vg-speaker-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { selectVgSpeaker(this.dataset.speaker); });
    });
    if (typeof VoiceGuide !== 'undefined' && VoiceGuide.isEnabled()) {
        if (vgToggle) { vgToggle.checked = true; }
        if (vgSettings) vgSettings.style.display = 'block';
        selectVgOutput(VoiceGuide.getOutput());
        selectVgSpeaker(VoiceGuide.getSpeaker());
    }
});

// ページ離脱時にも未送信データを保存
window.addEventListener('beforeunload', function() {
    if (S.active && S.pendingEvents && S.pendingEvents.length > 0) {
        var sec = Math.floor((Date.now() - S.startTime) / 1000);
        saveScanPending(S.pendingEvents, {
            duration_sec: sec,
            distance_m: calcDistance(S.routePoints),
            scan_mode: 'live-scan',
            device: navigator.userAgent.indexOf('iPhone') >= 0 ? 'iPhone' : 'Android',
            app_version: 'web_1.0',
            session_id_client: S.sessionId,
            is_final: true,
        });
    }
});
</script>
</body>
</html>
