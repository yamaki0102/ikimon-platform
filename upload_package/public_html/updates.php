<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>アップデート履歴 | ikimon</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>

<body class="js-loading pt-14 bg-base text-text font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main>
    <section class="pt-32 pb-16 px-6">
        <div class="max-w-3xl mx-auto" x-data="{ filter: 'all' }">
            <h1 class="text-3xl font-black mb-4">アップデート履歴</h1>
            <p class="text-gray-500 mb-6">ikimonの最新の改善と機能追加をお知らせします</p>

            <!-- Filter Tabs -->
            <div class="flex gap-2 mb-10 flex-wrap">
                <button @click="filter = 'all'"
                    :class="filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    class="px-4 py-2 rounded-full text-sm font-bold transition">すべて</button>
                <button @click="filter = 'feature'"
                    :class="filter === 'feature' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
                    class="px-4 py-2 rounded-full text-sm font-bold transition flex items-center gap-1.5">
                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> 新機能
                </button>
                <button @click="filter = 'fix'"
                    :class="filter === 'fix' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'"
                    class="px-4 py-2 rounded-full text-sm font-bold transition flex items-center gap-1.5">
                    <i data-lucide="wrench" class="w-3.5 h-3.5"></i> バグ修正・改善
                </button>
                <button @click="filter = 'security'"
                    :class="filter === 'security' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'"
                    class="px-4 py-2 rounded-full text-sm font-bold transition flex items-center gap-1.5">
                    <i data-lucide="shield" class="w-3.5 h-3.5"></i> セキュリティ
                </button>
            </div>

            <!-- Updates Timeline -->
            <div class="space-y-8">

                <!-- v0.8.1 — Sound Archive -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.8.1</span>
                        <time class="text-sm text-gray-500">2026年3月22日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">サウンドアーカイブ — 生き物の声を集めて同定しよう</h2>
                    <p class="text-gray-500 text-sm mb-4">ウォーク・スキャンで録音された「生き物っぽい音」を自動アーカイブ。誰でも聞いて種名を提案でき、みんなの力で同定を進められます。飼育動物の声も手動アップロードOK。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>自動アーカイブ</strong>: ウォーク・スキャン中に録音された音声のうち、AI同定に至らなかった「生き物っぽい音」を自動保存。周波数フィルタ（2-8kHz帯）で人の会話を端末側で除外します</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>手動アップロード</strong>: 音声+画像を同時にアップロード可能。飼育している犬や猫の声、庭の虫の鳴き声など、観察投稿とは別に気軽に記録できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>市民同定</strong>: 音声を聞いて「これは○○だと思う」と提案。3人の提案が一致すると「同定済み」に昇格。将来のAI学習データとしても活用予定</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>通報機能</strong>: 人の声やノイズが混入した音声は通報で非表示に。データは運営が確認用に保持します</span></li>
                    </ul>
                </article>

                <!-- v0.8.0 — My Zukan & Species Story -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.8.0</span>
                        <time class="text-sm text-gray-500">2026年3月22日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">マイ図鑑リニューアル & AIパーソナライズ種解説</h2>
                    <p class="text-gray-500 text-sm mb-4">図鑑を「マイ図鑑」に全面刷新。自分が出会った種だけの個人コレクションになり、AIがあなたの出会い体験に基づいた種解説を自動生成します。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>マイ図鑑</strong>: 図鑑を「自分が関わった種だけの個人コレクション」にリニューアル。投稿・同定・ライブスキャンで出会った種が自動的に蓄積されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>スキャンフレーム画像</strong>: ライブスキャンで検出された種のキーフレーム画像がマイ図鑑に表示されるように。撮影しなくても記録が残ります</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>AIパーソナライズ種解説</strong>: あなたの出会いコンテキスト（場所・季節・観察回数）に基づいた種解説をAIが自動生成。「3月の公園で3回出会ったシジュウカラ」のようなストーリーに</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>図鑑ページナビ</strong>: 種詳細ページに前後スワイプナビゲーション + 全種の総数表示。図鑑をめくる感覚で種を巡れます</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>写真カルーセルギャラリー</strong>: 種に関連する全出会い写真をスワイプで閲覧。フルスクリーン写真ビューアも搭載</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>クエストシステム再設計</strong>: 自己決定理論（SDT）・自己効力感・ジョブクラフティング理論に基づくクエスト設計に刷新。やらされ感のない内発的動機づけに</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>フィールドシグナル拡張</strong>: 自分のシグナル（無期限表示）に加え、他ユーザーのコミュニティシグナルも表示。フィールドの情報共有が活性化します</span></li>
                    </ul>
                </article>

                <!-- v0.8.0 — Fixes -->
                <article x-show="filter === 'all' || filter === 'fix'" x-transition class="relative pl-8 border-l-2 border-amber-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-amber-500 ring-4 ring-amber-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">v0.8.0</span>
                        <time class="text-sm text-gray-500">2026年3月22日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ライトボックス・ライブマップ・データ品質改善</h2>
                    <p class="text-gray-500 text-sm mb-4">写真閲覧体験の大幅改善、ライブマップのプライバシー強化、データ品質向上を行いました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>ライトボックス全面改善</strong>: ピンチズーム対応、スワイプ矢印ナビゲーション、インラインSVGアイコン化、タッチ操作の全面整理。スマホでの写真閲覧が快適に</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>ライブマップ完全メッシュ化</strong>: 個別ポイント表示を廃止し、メッシュポリゴンベースに完全移行。プライバシー保護と視認性を両立</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>一般カテゴリ名フィルタ</strong>: 「常緑広葉樹」「ミツバチ属」等の一般名がマイ図鑑・投稿・同定に混入しないよう自動フィルタリング</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>重複種の自動統合</strong>: 「ミツバチ」と「ミツバチ属」等の重複エントリを自動マージ。同名種のtaxon_keyも名前ベースで統合</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>OAuthアカウント統合修正</strong>: merged/bannedアカウントをスキップしmerge先を正しく返すように修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>DataStore並行書き込み修正</strong>: 複数の同時書き込みでデータが消失するバグを修正。増分送信＋オフラインフォールバックも改善</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>観察カード・探索ページ修正</strong>: 「...」メニューとリアクション表示の修正、探索ページからセンサー系データを除外</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>AI考察CSP修正</strong>: 「そうかも！」ボタンがCSPでブロックされる問題を解消。quick_post APIにAI考察キューイングも追加</span></li>
                    </ul>
                </article>

                <!-- v0.7.1 — AI Context & Data Persistence -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.7.1</span>
                        <time class="text-sm text-gray-500">2026年3月21日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ライブスキャンAI強化 & 環境データ永続保存</h2>
                    <p class="text-gray-500 text-sm mb-4">ライブスキャンのAI解析精度を向上させ、環境観測データとキーフレーム画像を100年耐久のデジタルツインに永続保存するようになりました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>AI文脈継続解析</strong>: スキャン中のAI解析に直前の検出結果と環境情報を自動注入。フレームごとに独立だった判定が「さっきシジュウカラを検出した公園の中」という文脈を持つようになり、種名のブレ防止と同定精度が向上します</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>環境観測データの完全保存</strong>: スキャン中の環境スキャン結果（植生・地形・水系・林冠被覆など）を全件永続保存。「森から河川敷に移動した」環境遷移の記録がデジタルツインに蓄積されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>検出×環境の紐付け</strong>: 各検出に「その瞬間の環境」をスナップショットとして紐付け。100年後の研究者が「この種はどんな環境で発見されたか」を正確に辿れます</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>キーフレーム選択保存</strong>: 新種検出・高信頼度検出の瞬間だけフレーム画像をサーバーに保存。全フレーム保存の1/10以下のストレージで、将来のAI再解析やエビデンス証拠を確保します</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>エビデンス自動昇格</strong>: キーフレームが保存された検出は evidence_tier が自動で昇格。データ品質の透明性が向上します</span></li>
                    </ul>
                </article>

                <!-- v0.7.1 — Livemap & Feed -->
                <article x-show="filter === 'all' || filter === 'fix'" x-transition class="relative pl-8 border-l-2 border-amber-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-amber-500 ring-4 ring-amber-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">v0.7.1</span>
                        <time class="text-sm text-gray-500">2026年3月21日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ライブマップ・フィード・表示改善</h2>
                    <p class="text-gray-500 text-sm mb-4">ライブマップの視認性向上やフィードの並び順修正など、日常利用の質を改善しました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>ライブマップUI/UX大幅改善</strong>: ポイントサイズの拡大、和名の優先表示、視認性の向上でフィールドでも使いやすく</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>和名優先表示</strong>: 学名・英名で登録された種も自動で和名に変換して表示。日本語ユーザーにやさしい画面に</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>フィードの並び順修正</strong>: 新しい投稿が上に表示されるよう、created_at降順でソート</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>クエスト専用ページ</strong>: クエスト一覧を専用ページに分離し、フッターナビからアクセス可能に</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>音声検出の表示改善</strong>: BirdNET検出の場所表示修正と検出回数の追加表示</span></li>
                    </ul>
                </article>

                <!-- v0.7.0 — Live Scan & Walk -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.7.0</span>
                        <time class="text-sm text-gray-500">2026年3月21日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ライブスキャン & ウォークモード</h2>
                    <p class="text-gray-500 text-sm mb-4">カメラをかざすだけでリアルタイムに生きものを検出する「ライブスキャン」と、散歩しながら野鳥の声を拾う「ウォーク」モードが登場。歩くだけで観察が進みます。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>ライブスキャン</strong>: カメラ映像をAIがリアルタイム解析し、フレーム内の生きものを自動検出。2秒間隔でスキャンし、植物・昆虫・鳥など同時に複数検出できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>環境コンテキストスキャン</strong>: 生きものだけでなく、植生・地面・水辺などの環境情報も自動で記録。生息環境と一緒にデータが残ります</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>スキャン地図</strong>: 検出された生きものがリアルタイムでミニマップにマーカー表示。カメラ上半分＋地図下半分の分割レイアウト</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>ウォークモード</strong>: 散歩中にBirdNETが野鳥の声を自動検出。ルートを地図に描画しながら、検出された鳥がマーカーで表示されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>天気情報表示</strong>: ウォーク開始前にOpen-Meteo連携で現在の天気・気温・風速を表示。観察コンディションが一目でわかります</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>オフライン対応</strong>: 圏外でもlocalStorageにデータを蓄積し、接続回復時に自動アップロード</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>Wi-Fi/モバイル自動最適化</strong>: 回線状況に応じて画像品質を自動調整。モバイル通信でもデータ量を抑えつつ検出精度を維持</span></li>
                    </ul>
                </article>

                <!-- v0.7.0 — Livemap -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.7.0</span>
                        <time class="text-sm text-gray-500">2026年3月21日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ライブマップ — 生物多様性デジタルツイン</h2>
                    <p class="text-gray-500 text-sm mb-4">ログイン不要で誰でも見られる公開ライブマップ。全ユーザーの観察データとスキャンデータが地図上でリアルタイムに可視化されます。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>公開ライブマップ</strong>: ログイン不要で閲覧可能。ikimonのデータを地図上で誰でも確認できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>カバレッジグリッド</strong>: 調査済みエリアをメッシュで可視化。どこがまだ調査されていないか一目でわかります</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>サイト境界表示</strong>: 登録されたモニタリングサイトの境界と効果指標をオーバーレイ表示</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>近くのトイレ表示</strong>: Overpass API連携で公衆トイレの位置を全地図に表示。フィールドワークの安心感をプラス</span></li>
                    </ul>
                </article>

                <!-- v0.7.0 — Scan Impact & Quests -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.7.0</span>
                        <time class="text-sm text-gray-500">2026年3月21日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">スキャンデータ活用 & 動的クエスト</h2>
                    <p class="text-gray-500 text-sm mb-4">ライブスキャンで集めたデータが各画面に反映されるようになりました。検出内容に基づいてクエストが自動生成されます。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>Impact表示</strong>: フィード・プロフィール・ダッシュボード・観察詳細の4画面にスキャン結果のインパクトサマリーを追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>動的クエスト生成</strong>: スキャンで検出された生きものに基づいて、パーソナライズされたクエストを自動生成。「さっき検出されたシジュウカラを撮影しよう」など</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>AI考察完了通知</strong>: 投稿した観察のAI考察が完了すると通知でお知らせ。待ち時間を気にせず次の観察に集中できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-emerald-400 shrink-0">✓</span><span><strong>フィードにスキャン活動サマリー</strong>: ライブスキャンのアクティビティがフィードに表示。コミュニティの観察活動が見えるように</span></li>
                    </ul>
                </article>

                <!-- v0.7.0 — Fixes -->
                <article x-show="filter === 'all' || filter === 'fix'" x-transition class="relative pl-8 border-l-2 border-amber-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-amber-500 ring-4 ring-amber-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">v0.7.0</span>
                        <time class="text-sm text-gray-500">2026年3月21日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">安定性・アカウント・GPS改善</h2>
                    <p class="text-gray-500 text-sm mb-4">認証まわりの安定性向上と、GPS位置情報の精度改善を行いました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>OAuth重複アカウント統合</strong>: 同じGoogleアカウントで複数の登録が作られる問題を修正。セカンダリメールの照合も追加し、既存アカウントへ自動統合されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>GPS精度向上</strong>: EXIF位置情報がデバイスGPSに上書きされる競合を解消。写真に埋め込まれた正確な位置が常に優先されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>Service Worker強制更新</strong>: 古いキャッシュが残り続ける問題を解消。旧SWの自動削除＋全キャッシュクリアで確実に最新版に更新されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>投稿画面の操作性修正</strong>: 写真削除ボタン・戻るボタン・送信ボタンがタップに反応しない問題を修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>プロフィール表示修正</strong>: 記録数・種数が0と表示される問題を修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>ガイドページ追加</strong>: 「ikimonのアプローチ — 100年後の生態系のために」ページを新設。AI活用の哲学やデータの考え方を紹介しています</span></li>
                    </ul>
                </article>

                <!-- v0.6.1 — FIX -->
                <article x-show="filter === 'all' || filter === 'fix'" x-transition class="relative pl-8 border-l-2 border-amber-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-amber-500 ring-4 ring-amber-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">v0.6.1</span>
                        <time class="text-sm text-gray-500">2026年3月20日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">タッチ操作・ナビゲーション改善</h2>
                    <p class="text-gray-500 text-sm mb-4">モバイルでのボタン操作やフッターの反応に関する問題を修正しました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>ボトムナビ「マイページ」ボタン修正</strong>: タップしても反応しなかった問題を修正。Alpine.jsスコープの設定漏れが原因でした</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>フッターリンクのタッチ領域拡大</strong>: 全フッターリンクのタップ領域を44px（推奨最小値）に拡大。押しにくかった問題を解消</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>閉じるボタンの操作性向上</strong>: PWAバナー、検索クリア、写真削除、各モーダルの閉じるボタンを44px以上に統一</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>アクセシビリティ向上</strong>: アイコンのみのボタンにaria-labelを追加。スクリーンリーダーでも操作内容が分かるように</span></li>
                    </ul>
                </article>

                <!-- Infrastructure -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500 ring-4 ring-green-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">インフラ</span>
                        <time class="text-sm text-gray-500">2026年3月20日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">専用VPSへの移行</h2>
                    <p class="text-gray-500 text-sm mb-4">より高速で安定したサービス提供のため、サーバー基盤を専用VPSへ移行しました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>専用VPS移行</strong>: 共有サーバーから6コア/12GB/400GB NVMe SSDの専用環境に。ページ表示速度とAPI応答が向上します</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>SSL/HTTPS対応</strong>: Let's Encrypt による常時SSL化。全通信が暗号化されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>PostgreSQL + PostGIS</strong>: 地理空間データベースを導入。将来的なデータ量の増加と高度な空間検索に対応する基盤を整備しました</span></li>
                    </ul>
                </article>

                <!-- v0.6.0 — Growth Learning Loop -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500 ring-4 ring-green-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.6.0</span>
                        <time class="text-sm text-gray-500">2026年3月20日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">Growth Learning Loop — 学びのループが回り始める</h2>
                    <p class="text-gray-500 text-sm mb-4">投稿→考察→成長実感→また投稿したくなる。ikimonの核心である「学習ループ」を強化する大型アップデートです。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>AI考察ティーザー</strong>: 投稿完了画面で「考察ミル」の第一印象をすぐに表示。投稿→考察の間の壁をなくしました</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>QRコード招待</strong>: プロフィールからQRコードを表示して、フィールドで出会った人にパッと招待できます。全画面表示モード付き</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>招待ランディングページ</strong>: 招待された人に考察ミルの価値を実際の観察例で見せる専用ページ。OGP対応でLINE/Twitterでもリッチに展開されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>学習ヒントカード</strong>: ホームフィードに「次にここを見ると深く分かるよ」カードを表示。前回の考察から次の観察への橋渡し</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>成長ログ</strong>: 分類精度・観察ポイント・分類群カバーの3指標で観察力の変化を可視化。「前より見えるようになった自分」が分かります</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>初回/最新観察の比較</strong>: プロフィールに最初の観察と最新の観察を並べて表示。見比べるだけで成長が実感できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>デイリークエストUI</strong>: プロフィールに今日の目標3つを表示。達成するとスコアとバッジが獲得できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>考察ミルの質向上</strong>: 「次に出会った時にこう撮ると絞れる」という具体的な1アクションを提案。撮り直し要求ではなく、次の出会いに備える設計に</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>パーソナライズ考察</strong>: 過去の観察履歴を踏まえて、観察者のレベルに合わせた考察を生成するように</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>KPI計測基盤</strong>: AI考察展開率・招待経由登録数・学習ヒントクリック数など16種のイベントを新規追加</span></li>
                    </ul>
                </article>

                <!-- v0.6.0 — Multi-Subject -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.6.0</span>
                        <time class="text-sm text-gray-500">2026年3月19日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">マルチサブジェクト観察 & 学名自動正規化</h2>
                    <p class="text-gray-500 text-sm mb-4">1つの写真に複数の生物が写っている場合、それぞれ独立して同定・AI解説できるようになりました。また、どんな言語で名前を入力しても学名に自動変換されます。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>マルチサブジェクト対応</strong>: 1つの観察に「植物」「昆虫」など複数の生物を記録可能に。タブで切り替えて、それぞれのAI考察と同定を確認できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>AI複数生物検出</strong>: AIが写真内の複数生物を自動検出し、それぞれ独立した解説・手がかり・次のステップを提示。植物は属レベル、昆虫は科レベルなど、精度に応じた解説を出します</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>同定の自動振り分け</strong>: 「アリ科」と同定すれば自動で昆虫サブジェクトに、「トベラ」なら植物サブジェクトに振り分け。分類階層(kingdom)を見て判定します</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>3段階 学名自動正規化</strong>: 「カエル」「Frog」「Anura」など、どの言語で入力しても学名に自動変換。①オモイカネDB(2971種)→②TaxonSearch→③GBIF APIの3段階で解決します</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>サブジェクト別コンセンサス</strong>: 各生物ごとに独立した合意形成。植物と昆虫で別々にコミュニティの意見が集約されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>同定フォーム改善</strong>: 複数サブジェクトがある観察では「どの生物について？」のセレクターが表示。検索候補のドロップダウンも修正しました</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>Darwin Core 互換</strong>: マルチサブジェクトのデータモデルは DwC Event Core + Occurrence Extension パターンに準拠。GBIF等への将来的なデータ提供にも対応</span></li>
                    </ul>
                </article>

                <!-- v0.5.3 — FIX -->
                <article x-show="filter === 'all' || filter === 'fix'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500 ring-4 ring-green-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.5.3</span>
                        <time class="text-sm text-gray-500">2026年3月19日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">同定フォーム修正</h2>
                    <p class="text-gray-500 text-sm mb-4">種名検索・同定送信が正常に動作するようになりました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>同定フォーム送信修正</strong>: 種名検索結果のフィールド名ミスマッチにより同定が送信できないバグを修正。目・科レベルの同定も正常に動作します</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>同定センター修正</strong>: クイック同定パネルにも同様の修正を適用</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>APIエラーハンドリング強化</strong>: PHPエラーをJSON形式で返すように改善し、無応答500エラーを解消</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>コウモリ目カタカナ表記</strong>: ローカルリゾルバーに追加し、検索で「翼手目」ではなく「コウモリ目」が優先表示されるように</span></li>
                    </ul>
                </article>

                <!-- v0.5.2 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.5.2</span>
                        <time class="text-sm text-gray-500">2026年3月17日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">AI考察の専門用語かんたん解説</h2>
                    <p class="text-gray-500 text-sm mb-4">観察のヒントに出てくる専門用語に、小中学生でもわかるやさしい解説がつくようになりました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>用語ツールチップ</strong>: AI考察内の専門用語（形質・花序・同定など）にカーソルを合わせるかタップすると、やさしい日本語で解説が表示されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>150語以上の用語辞書</strong>: 分類階級・形態（翅・嘴・触角）・植物（花序・鋸歯・葉序）・生態（在来種・擬態・食物連鎖）など幅広くカバー</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>スマート検出</strong>: 「シジュウカラ科」の「科」など、生物名の一部として使われている場合は解説を出さない賢い判定</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>モバイル対応</strong>: スマートフォンでもタップで解説を表示。他の場所をタップすれば閉じます</span></li>
                    </ul>
                </article>

                <!-- v0.5.1 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.5.1</span>
                        <time class="text-sm text-gray-500">2026年3月17日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ナビゲーション刷新 & 統合マイページ</h2>
                    <p class="text-gray-500 text-sm mb-4">ユーザーメニューを大幅に整理し、マイページに全ての個人情報を集約しました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ユーザーメニュー刷新</strong>: 13項目あったドロップダウンを3項目（マイページ・ダッシュボード・ログアウト）に集約。迷わないナビゲーションに</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>統合マイページ</strong>: 「発見」「ウェルネス」タブを新設。デジタル標本箱とネイチャーウェルネスをマイページ内で直接閲覧可能に</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>モバイルメニュー統一</strong>: デスクトップ・モバイル共にパーソナル情報はマイページに集約。サイト情報系はフッターに移動</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>専門家向けページ刷新</strong>: 研究者・調査員・同定者の3つの役割を1ページに統合。調査プロジェクトへの導線を明確化</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>フッター整理</strong>: 料金プランを追加、重複リンク（チーム）を削除</span></li>
                    </ul>
                </article>

                <!-- v0.5.0 — NEW + SECURITY -->
                <article x-show="filter === 'all' || filter === 'feature' || filter === 'security'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.5.0</span>
                        <time class="text-sm text-gray-500">2026年3月17日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SECURITY</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">セマンティック検索と写真検索</h2>
                    <p class="text-gray-500 text-sm mb-4">生き物の探し方が広がりました。種名がわからなくても、写真や自然な文章から似た記録を見つけられるようになりました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>写真で探す</strong>: カメラで撮った写真やギャラリーから、見た目が似ている生き物の記録を検索。「みつける」ページの検索バー横のカメラアイコンから利用できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セマンティック検索</strong>: 「春の森の蝶」「夜に鳴く虫」のような自然な文章で検索できるように。種名がわからなくても、特徴や状況の説明から関連する記録を探せます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>似ている観察</strong>: 各観察記録の詳細ページに「似ている観察」セクションを追加。種名・分類・環境・季節・写真の特徴を総合的に分析し、関連する記録を自動表示します</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>高精度ベクトル検索</strong>: 全観察データを3072次元のマルチモーダルベクトルで再構築。テキストと画像を同じ空間で扱うクロスモーダル検索に対応</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>非同期ジョブシステム</strong>: AI査定・ベクトル生成・データ再計算を並列処理する基盤を導入。投稿後のレスポンス速度が向上しました</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>FAQ更新</strong>: 「検索・発見」カテゴリを追加。写真検索の仕組み・プライバシー保護・類似度の読み方など6問を収録</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セキュリティ修正</strong>: XSS対策の強化、キュー処理の排他制御追加、エラーハンドリング改善</span></li>
                    </ul>
                </article>

                <!-- v0.4.5 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.4.5</span>
                        <time class="text-sm text-gray-500">2026年3月12日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">プラットフォーム仕上げ</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>PWA刷新</strong>: アプリアイコン・マニフェストを更新。ホーム画面からの起動体験を改善</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ビジネスページ改善</strong>: 企業向けランディングページとサイトメッセージングを刷新</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>管理ダッシュボード</strong>: 管理者向け分析・レポートフローを整備</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>探索体験の改善</strong>: アプリ全体の発見フロー・ディスカバリー体験を強化</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ウェルネス・ハビットループ</strong>: 自然観察を日常の習慣にするためのガイダンス機能</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ストリーク活動サマリー</strong>: 継続的な観察活動を可視化</span></li>
                    </ul>
                </article>

                <!-- v0.4.0 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.4.0</span>
                        <time class="text-sm text-gray-500">2026年3月6日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ゲーミフィケーション & ホームリデザイン</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ゲーミフィケーション & パーソナライゼーション</strong>: バッジ・ランク・デイリークエスト・ストリーク表示でモチベーションを継続</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ユーザー分析ダッシュボード</strong>: 自分の活動データを振り返れるマイページを追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ホームページ全面リデザイン</strong>: マイルストーン型の種表示、ヒーローセクション刷新</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>Omoikaneプロジェクト</strong>: 文献ベースの信頼スコア・スマート検索・AI相互検証機能</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>参考インデックスへのリブランド</strong>: BISスコアをより正確な「モニタリング参考インデックス」に改称</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>CSP nonce・CDNバージョン固定</strong>: Lucide 0.477.0、Alpine.js 3.14.9</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>SEO準備</strong>: robots.txt、sitemap.xml、GA4タグ整備</span></li>
                    </ul>
                </article>

                <!-- v0.3.5 — FIX + SECURITY -->
                <article x-show="filter === 'all' || filter === 'fix' || filter === 'security'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.3.5</span>
                        <time class="text-sm text-gray-500">2026年3月5日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SECURITY</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">同定ワークベンチ & セキュリティ</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>同定ワークベンチ UX全面改善</strong>: 初見ユーザー向けオンボーディング、プリセットフィルター、モバイル対応を追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>API品質修正</strong>: JSONフラグ混入バグ13件を一括修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セキュリティ</strong>: target=_blank rel属性追加、開発用ファイル本番排除、JSON I/OにLOCK_EX付与、PHP9互換対応</span></li>
                    </ul>
                </article>

                <!-- v0.3.0 — FIX -->
                <article x-show="filter === 'all' || filter === 'fix'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.3.0</span>
                        <time class="text-sm text-gray-500">2026年3月4日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">大規模品質改善</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ダッシュボード刷新</strong>: HUD UIから標準デザインへ全面リニューアル。ランクカード、デイリークエスト、カテゴリ探索を搭載</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>UI全面改善</strong>: 英語テキスト日本語化、ランキング廃止、フッター追加、CSS変数化、全ページの視覚バランス統一</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ナビゲーション改善</strong>: Quick Navアイコン差別化、モバイルボトムナビ操作性向上（56px化）</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ヘッダーオーバーラップ修正</strong>: 全ページでコンテンツがヘッダーに隠れる問題を解消</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>アクセシビリティ強化</strong>: テキストコントラスト全修正、mainタグ追加、sr-only見出し、ボタンスタイル統一</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>観察詳細ページ改善</strong>: 同定後の反映バグ修正、画像クリックナビゲーション、TrustLevel致命的バグ修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>位置情報修正</strong>: 「読み込み中」「場所不明」で止まる問題を全ページで修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>探索フィルター修正</strong>: カテゴリフィルター（鳥類・昆虫・植物等）が正しく動作するよう修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>Aboutページ刷新</strong>: チームセクション→創業者セクションに変更</span></li>
                    </ul>
                </article>

                <!-- v0.2.5 — NEW + SECURITY -->
                <article x-show="filter === 'all' || filter === 'feature' || filter === 'security'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.2.5</span>
                        <time class="text-sm text-gray-500">2026年2月27日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SECURITY</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">セキュリティ強化 & AI複数画像対応</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セキュリティ強化</strong>: Cookie Secure属性、HTTPS強制、HSTS 1年、Mixed Content防止</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>AI推定の複数画像対応</strong>: 最大3枚の写真を同時にAIに送信して精度を向上</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>Android写真保存ボタン</strong>: Android端末での写真ダウンロードに対応</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>APIキー保護</strong>: URLパラメータからHTTPヘッダーに移行し、ログ漏洩を防止</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>B2Bデザイン統一</strong>: ランディングページのバナーをダークテーマに統一</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>レッドリスト判定精緻化</strong>: LC/DD（低懸念/情報不足）を除外し、CR/EN/VU/NTのみを真の絶滅危惧種としてカウント</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ユーザーデータ保護</strong>: import_sourceマーカー導入、data/ディレクトリをデプロイ対象から除外</span></li>
                    </ul>
                </article>

                <!-- v0.2.1 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.2.1</span>
                        <time class="text-sm text-gray-500">2026年2月21日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">100年アーカイブ & 図鑑エンジン</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>100年アーカイブ戦略</strong>: Darwin Core準拠のメタデータ、分類タイムライン、歴史的学名の表示に対応</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>図鑑デジタル化エンジン</strong>: 書籍からの情報抽出パイプライン構築、SQLite統合による高速検索</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>Omoikane AI文献検索</strong>: 875本の学術論文を統合した知識ベースとUIを搭載。自動修復キューシステム付き</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ナビゲーション全面改修</strong>: モバイルメニュードロワー、レスポンシブ対応の強化</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>DwC-Aエクスポート拡張</strong>: 歴史的分類フィールド（originalNameUsage等）を追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>サイトダッシュボード日本語化</strong>: ラベル・説明文の完全ローカライズ</span></li>
                    </ul>
                </article>

                <!-- v0.2.0 — NEW + SECURITY -->
                <article x-show="filter === 'all' || filter === 'feature' || filter === 'security'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.2.0</span>
                        <time class="text-sm text-gray-500">2026年1月1日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SECURITY</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">新年アップデート</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>PWA対応</strong>: ホーム画面に追加できるようになりました</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>TNFD対応レポート</strong>: 企業向けの自然関連情報開示に使える参考レポートを自動生成</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セキュリティ強化</strong>: セッション管理、レート制限を追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>プライバシー保護</strong>: 写真のEXIF位置情報を自動削除、希少種の位置マスキング</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ペルソナ別ページ</strong>: 市民/企業/研究者それぞれに向けたランディングページを新設</span></li>
                    </ul>
                </article>

                <!-- v0.1.5 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.5</span>
                        <time class="text-sm text-gray-500">2025年12月15日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">企業向け機能</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-blue-400 shrink-0">✓</span><span><strong>企業ダッシュボード</strong>: サイト別の生物多様性可視化</span></li>
                        <li class="flex items-start gap-2"><span class="text-blue-400 shrink-0">✓</span><span><strong>参考インデックス</strong>: 観測の厚みと保全シグナルの自動要約</span></li>
                        <li class="flex items-start gap-2"><span class="text-blue-400 shrink-0">✓</span><span><strong>地図埋め込み</strong>: 自社サイトに地図を埋め込み可能に</span></li>
                    </ul>
                </article>

                <!-- v0.1.0 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.0</span>
                        <time class="text-sm text-gray-500">2025年11月1日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ベータ版</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-purple-400 shrink-0">✓</span><span><strong>観察投稿機能</strong>: 写真から生き物を記録</span></li>
                        <li class="flex items-start gap-2"><span class="text-purple-400 shrink-0">✓</span><span><strong>コミュニティ同定</strong>: みんなで種名を提案・合意する仕組み</span></li>
                        <li class="flex items-start gap-2"><span class="text-purple-400 shrink-0">✓</span><span><strong>地図探索</strong>: 周辺の生き物を地図で確認</span></li>
                        <li class="flex items-start gap-2"><span class="text-purple-400 shrink-0">✓</span><span><strong>ゲーミフィケーション</strong>: バッジとランク機能</span></li>
                    </ul>
                </article>

            </div>

            <!-- Newsletter signup -->
            <div class="mt-16 p-8 rounded-2xl bg-white border border-gray-200 shadow-sm text-center">
                <h3 class="text-lg font-bold mb-2">最新情報をお届けします</h3>
                <p class="text-sm text-gray-500 mb-4">新機能リリース時にメールでお知らせします</p>
                <div class="flex gap-2 max-w-md mx-auto">
                    <input type="email" placeholder="メールアドレス"
                        class="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]">
                    <button class="btn-primary whitespace-nowrap">登録</button>
                </div>
            </div>

        </div>
    </section>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
