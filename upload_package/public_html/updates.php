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
        <div class="max-w-3xl mx-auto">
            <h1 class="text-3xl font-black mb-4">アップデート履歴</h1>
            <p class="text-gray-500 mb-12">ikimonの最新の改善と機能追加をお知らせします</p>

            <!-- Updates Timeline -->
            <div class="space-y-8">

                <!-- v0.6.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.6.0</span>
                        <time class="text-sm text-gray-500">2026年3月14日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">調査員ネットワークと法人向け導線をまとめて強化しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>認定調査員を探せるように</strong>: <code>調査員一覧</code>、<code>プロフィール</code>、<code>公式記録</code>、<code>調査依頼</code> の導線を追加し、現場と調査できる人をつなぎやすくしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>法人プランごとの見え方を整理</strong>: サイトの記録ボードやレポート系で、契約プランに応じて種詳細や高度出力の扱いを切り替えるようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>図鑑と観察に関連書籍の導線を追加</strong>: 種や文脈に応じて関連書籍を出せるようにし、より深く知りたい人が次の行動へ進みやすくしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>PWA アイコンとホーム導線も更新</strong>: アプリアイコン、マニフェスト、トップページまわりを見直し、スマホでの使い始めや再訪を分かりやすくしました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.9 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.9</span>
                        <time class="text-sm text-gray-500">2026年3月12日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">組織利用の申込み後導線を、実運用しやすい形に整えました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ワークスペースの入口を追加</strong>: 申込み後にそのまま入れる <code>corporate_dashboard</code>、メンバー招待、設定ページを追加し、運用開始までの導線を明確にしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>招待リンク方式へ変更</strong>: 既存アカウント前提をやめて、申込み担当者や管理メンバーを招待リンクで受け入れられるようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>運営側の受付管理も強化</strong>: admin 画面から契約団体の作成、招待リンク発行、ワークスペース確認までを一画面で進めやすくしました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.8.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.8.1</span>
                        <time class="text-sm text-gray-500">2026年3月12日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">for Business の料金表と言葉づかいを整理しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>料金表を使い方ベースに整理</strong>: <code>Pro</code> と <code>Public</code> を「誰向け」ではなく「どう使うか」で読める説明へ寄せました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>追加サイトの説明を Public カードへ移動</strong>: 条件に関係するオプションだけを、関係するプランの中で読める形に変更しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>Cookie バナーも小さく整理</strong>: 画面下いっぱいに広がる形をやめて、右下のコンパクトな同意カードに変更しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.8 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.8</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">AIの複数候補を、次の同定につなげやすくしました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>見分け候補をそのまま辿れるように</strong>: 観察詳細の <code>見分け候補</code> は、候補名をタップすると近い記録を探せるリンクに変えました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>同定ワークベンチに <code>AI複数候補</code> フィルタを追加</strong>: AIが複数の可能性を出している観察だけを拾って、人が次に見たい観察を探しやすくしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>候補の揺れを隠さず活用</strong>: AIの迷いを消すのではなく、「どこが迷いどころか」を観察者と同定者の両方に役立つ形で見せる方向へ寄せました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.7 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.7</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">投稿前AIを外し、投稿後の観察ヒントへ一本化</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>投稿画面の「AIにきいてみる」を撤去</strong>: エラーが起きやすく、投稿後のAIメモと役割が重なっていたため、投稿前の導線を外しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>投稿後に自動で付くことを明示</strong>: 投稿画面では、写真・場所・季節をもとに観察詳細ページへ AIメモがあとから付くことだけを案内する形に整理しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>FAQ も新仕様へ更新</strong>: 投稿前AIの説明を整理し、今は「まず投稿して、あとから観察のヒントを見る」流れだと分かるようにしました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.6 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.6</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">利用規約とプライバシー説明のトーンも整理</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>機能名を現状に合わせて更新</strong>: <code>レポート生成</code> などの表現を、実際の導線に近い <code>まとめ出力</code> へ寄せました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>免責と用途説明を整理</strong>: 研究や外部資料への利用時は検証を推奨する立て付けは残しつつ、表現を必要以上に研究寄りにしないよう調整しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>プライバシー説明も新ステータスへ整合</strong>: EXIF の扱いと GBIF 共有条件を、現在の <code>研究利用可 / 種レベル研究用</code> の考え方に合わせて更新しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.5 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.5</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">入口導線も「記録を残す」軸にそろえました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ナビゲーションとフッターを整理</strong>: <code>企業・研究者の方へ</code> のような狭い言い方を減らし、組織利用やデータ持ち帰りにも開いた入口へ調整しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>Aboutページの物語を調整</strong>: 認定・評価・研究グレードを前面に出すのではなく、自然の記録を残す土台づくりとして読みやすい文脈へ寄せました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>デモページの訴求を再定義</strong>: <code>TNFDレポートが完成する</code> ではなく、その場所の自然がどう積み上がり、どう見返せるかを体験する導線に変更しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.4 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.4</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">価値訴求を「評価」から「記録・参加・継続」へ調整</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>組織向けページの言い方を調整</strong>: <code>レポート</code> や <code>解析</code> を主役にせず、自然の記録を残す・見返す・共有する価値が伝わる表現へ寄せました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>サイトダッシュボードを「記録ボード」寄りに</strong>: 数値の意味を内部向けの目安として明示し、強い結論や外部評価の代替に見えにくい説明へ変更しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>研究導線のトーンを緩和</strong>: 「研究を加速する」ではなく、研究・教育・地域アーカイブ用途でデータを持ち帰るページとして整理しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.3 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.3</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">料金体系を3プラン + 公開オプションに整理</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>自治体にも入りやすい入口価格へ</strong>: <code>Public</code> を月額 39,800 円に設定し、1サイト・5席の標準導入として公開しました。これまでの「高い or 安すぎる」の中間を整理しています</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>3プランに簡素化</strong>: <code>Pro / Public / Portfolio</code> の3段構成にまとめ、個別見積り前提ではなく、公開価格で選べるようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>追加オプションを明示</strong>: 追加サイト、追加席、AI解析、優先サポートを別立てにし、入口価格を軽くしたまま大規模運用へ伸ばせる形にしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>申込フォームと FAQ も更新</strong>: 料金導線、申込プラン、よくある質問の文言を新体系に揃えました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.2 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.2</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">研究利用ステータスの見直し</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>種だけを研究利用可の条件にしない設計へ</strong>: 科・属レベルでコミュニティ合意が安定している記録も、研究やモニタリングに使えるデータとして扱うようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>表示ステータスを二層化</strong>: 種まで安定した記録は <code>種レベル研究用</code>、科・属まで安定した記録は <code>研究利用可</code> と表示し、精度と信頼を分けて見られるようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>FAQ と通知文言を更新</strong>: 研究グレードの説明、観察詳細の表示、同定完了通知を新しい考え方に合わせて更新しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.1</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">AIメモの読みやすさ改善 & 今年投稿分への再適用</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>観察者寄りの表示に整理</strong>: 観察詳細ページの AI メモを「結論 → 手がかり → 次にあると絞りやすいもの」の順で読みやすく再構成しました。モデル名の表示は外し、補足も折りたたまずそのまま読めます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>安全側の分類と有力候補を分離</strong>: 候補が複数ある場合でも、AIメモは共通して言える安全側の分類を優先表示しつつ、候補の中でいちばん近い分類群も別に示すようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>AIメモ統合パイプラインを更新</strong>: <code>memo_fusion_v1</code> を導入し、候補群の共通系統をまとめた <code>recommended_taxon</code> と、最も細かい仮説である <code>best_specific_taxon</code> を併記できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>今年投稿分を再生成</strong>: 2026年に投稿された既存データ 24 件の AI メモを新フォーマットで再生成し、<code>observation_assessment_v3</code> / <code>memo_fusion_v1</code> に揃えました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.0</span>
                        <time class="text-sm text-gray-500">2026年3月10日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">施設由来記録対応 & 投稿後AI考察の自動生成</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>施設由来データの一等市民化</strong>: 植物園・動物園・水族館・保全施設での記録を「施設由来の生物データ」として正式管理。<code>organism_origin</code>（野生 / 飼育 / 栽培 / 逸出）と施設ID が独立フィールドとして保存され、野生記録とは分離して扱われます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>投稿後AI考察の自動生成</strong>: 観察を投稿すると、写真・位置情報・季節をもとにAIが非同期で考察を自動生成し、観察詳細ページに「AIメモ」として公開表示されます。AIは同定の票としてではなく「根拠付き公開注釈者」として動作し、コミュニティ合意には影響しません</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>地理・季節コンテキストの考慮</strong>: AI考察が形態だけでなく、撮影地の都道府県・緯度経度・季節も補助証拠として参照。「場所から見るヒント」「季節から見るヒント」として結果に反映されます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>複数枚写真の一括評価</strong>: 投稿された複数の写真を最大3枚まとめて評価。1枚ではわからなかった形質の補完が可能になりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>観察者寄りのAIトーン</strong>: 「不足」ではなく「あるともっと絞りやすい情報」、「次に効く一手」ではなく「次に試すと良さそう」など、観察者を萎縮させない言葉で記述。「この観察の良いところ」フィールドで自己効力感を伝えます</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.4.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.4.0</span>
                        <time class="text-sm text-gray-500">2026年3月9日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">同定システム刷新 — 系統整合性・LCA合意計算</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>Canonical Taxon 保存</strong>: 同定を自由記述ではなく、GBIF/iNaturalist に紐づく canonical taxon（安定ID・学名・系統パス）として保存するようになりました。将来の名前変更にも対応できる堅牢なデータ構造です</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>LCA ベース合意計算</strong>: 「完全一致多数決」から「系統的最近共通祖先（LCA）ベース加重多数決」に切り替えました。属レベルの同定と種レベルの同定が共存していても、より深い合意の祖先分類群を <code>community_taxon</code> として決定します</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>系統コンフリクト検出</strong>: 同一観察に対して系統的に矛盾した同定（例: アブラゼミとミンミンゼミ）が混在する場合に <code>lineage_conflict</code> を自動検出し、ステータス昇格をブロックします</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>best_supported_descendant_taxon</strong>: 研究者向けに、コミュニティ合意より詳細な「最も支持された末端分類群」を別フィールドで保持するようになりました。<code>community_taxon</code>（保守的）と <code>best_supported_descendant_taxon</code>（詳細）の二層構造です</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>Taxonomy バージョン管理</strong>: 各同定・観察データに <code>taxonomy_version</code> を記録し、分類体系の更新時に再計算が必要なデータを追跡できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>既存データの再正規化</strong>: 全観察データ（120件）の同定を canonical taxon に一括変換し、合意を再計算しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.4 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.4</span>
                        <time class="text-sm text-gray-500">2026年3月9日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">個体数フィールド & データ品質エビデンス機能</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>個体数の記録に対応</strong>: 投稿画面で周辺の個体数（1, 2〜5, 6〜10, 11〜50, 50+）を選択できるようになりました。正確でなくてOK — 長期的な個体数変動の追跡に活用されます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>同定エビデンス（証拠）タグ</strong>: 名前を入力した際に「体色・模様」「全体的な形」「行動・鳴き声」などの同定根拠を選択できるようになりました。データの信頼性（Data Quality）を高めます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>環境バイオーム・地面の状態</strong>: 森林・草地・湿地・海岸・都市・農地の環境分類と、岩場・砂地・落ち葉など地面の状態を記録できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>GBIF/Darwin Core互換</strong>: 個体数データは国際標準の <code>individualCount</code> フィールドとしてエクスポートされます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>表示の統合</strong>: ホーム・探索・観察詳細の各画面に個体数バッジ（×N）を追加し、記録の情報量が一目でわかるようになりました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.3 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.3</span>
                        <time class="text-sm text-gray-500">2026年3月9日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ログイン復旧 & データ整合性の改善</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ソーシャルログイン復旧</strong>: Google / X（Twitter）でのログインボタンが一時的に表示されない問題を修正しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>投稿の表示順を改善</strong>: 過去の日付の写真を投稿した際に、フィードに表示されない問題を修正しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>同定カウントの反映を修正</strong>: 同定を追加した際にトップページのカウントに正しく反映されるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>データストア最適化</strong>: 観察データの保存構造を最適化し、読み書きの整合性を向上させました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.2 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.2</span>
                        <time class="text-sm text-gray-500">2026年3月8日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ネイチャーポジティブガイド & サイト改善</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ネイチャーポジティブ完全ガイド公開</strong>: お散歩×生きもの観察×脳活性化の三位一体を科学的エビデンスとともに解説するピラーページを新設</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>トップページにガイドへの導線追加</strong>: ヒーロー下部のクイックナビに「ネイチャーポジティブ」リンクを追加</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>フッターにガイドリンク追加</strong>: 全ページ共通フッターのServiceカラムにネイチャーポジティブガイドへのリンクを追加</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ガイドページのデザイン改善</strong>: Lucideアイコン統合、Design System v2トークン準拠、レスポンシブ・アクセシビリティ強化</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.1</span>
                        <time class="text-sm text-gray-500">2026年3月8日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">AI同定 & 環境自動推定</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>「AIにきいてみる」機能を追加</strong>: 写真から生き物の分類（目・科・属レベル）をAIが推定。種の断定はせず、参考情報として提案します</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>環境情報の自動入力</strong>: 写真の背景からバイオーム（森林・都市など）、野生/植栽、ライフステージ、地面の状態をAIが推定し、ワンタップでフォームに反映</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>AIモデルをアップグレード</strong>: Gemini 2.5 Flash → 3.1 Flash Lite に移行。応答速度2.5倍、コスト40%削減を実現</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>分類精度の柔軟化</strong>: 科レベル固定から、確信度に応じて目〜属レベルまで柔軟に回答するように改善</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.0</span>
                        <time class="text-sm text-gray-500">2026年3月7日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">UX改善 & ストランドマップ修正</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>地域達成度メーター刷新</strong>: 「0/15225種」のような遠い目標値表示から、マイルストーン制レベルシステムに変更。次の目標が常に手の届く距離に</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ストランドマップ修正</strong>: 観察データがない地点にヒートマップの色が広がるバグを修正。座標データの整合性を改善し、表示半径を最適化</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ホームページレイアウト改善</strong>: ヒーローセクションとフィード間の余白を調整し、視認性を向上</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>企業向け用語統一</strong>: 企業ダッシュボード・レポート全体の指標名称を「参考インデックス」に統一し、より分かりやすい表現に</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>データ品質向上</strong>: テスト用ダミーデータの除去、プライバシーフィルターの座標処理改善</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.2.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.2.1</span>
                        <time class="text-sm text-gray-500">2026年3月6日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">セキュリティ & インフラ強化</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>セキュリティ強化</strong>: CSP nonce、OAuth設定改善</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>アクセシビリティ向上</strong>: ARIA、altテキスト、キーボード操作</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>CDNバージョン固定</strong>: Lucide 0.477.0、Alpine.js 3.14.9</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>SEO最適化</strong>: robots.txt、sitemap.xml</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ゲーミフィケーション & パーソナライゼーション</strong>: 体験の没入感と継続性を強化</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.2.0 -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.2.0</span>
                        <time class="text-sm text-gray-500">2026年3月4日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">大規模品質改善アップデート</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>ダッシュボード刷新</strong>: HUD UIから標準デザインへ全面リニューアル。ランクカード、デイリークエスト、カテゴリ探索を搭載</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>CDNバージョン固定</strong>: Lucide・Alpine.js・セキュリティ向上のため外部ライブラリを特定バージョンに固定</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>ナビゲーション改善</strong>: Quick Navのアイコン差別化、モバイルボトムナビの操作性向上（56px化）</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>ヘッダーオーバーラップ修正</strong>: 全ページでコンテンツがヘッダーに隠れる問題を解消</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>アクセシビリティ強化</strong>: mainタグ追加、sr-only見出し、ボタンスタイル統一</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>メタタイトル統一</strong>: 全情報ページのSEOタイトルを統一フォーマットに</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>セキュリティ</strong>: 管理画面の認証強化、開発用ファイルのアクセス制限追加</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>探索フィルター修正</strong>: カテゴリフィルター（鳥類・昆虫・植物等）が正しく動作するよう修正</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>仕様書更新</strong>: sitemap.md / spec.md を90ページ・99 APIの実態に合わせて全面更新</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.1.2 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.2</span>
                        <time class="text-sm text-gray-500">2026年1月1日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">新年アップデート</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>PWA対応</strong>: ホーム画面に追加できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>TNFD対応レポート</strong>: 企業向けPDFレポートを自動生成</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>セキュリティ強化</strong>: セッション管理、レート制限を追加</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>プライバシー保護</strong>: 写真のEXIF位置情報を自動削除</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>ペルソナ別ページ</strong>: 市民/企業/研究者向けのランディングページ</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.1.1 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.1</span>
                        <time class="text-sm text-gray-500">2025年12月15日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">企業向け機能追加</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-blue-400 shrink-0">✓</span>
                            <span><strong>企業ダッシュボード</strong>: サイト別の生物多様性可視化</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-blue-400 shrink-0">✓</span>
                            <span><strong>参考インデックス</strong>: 観測の厚みと保全シグナルの自動要約</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-blue-400 shrink-0">✓</span>
                            <span><strong>地図埋め込み</strong>: 自社サイトに地図を埋め込み可能に</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.1.0 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.0</span>
                        <time class="text-sm text-gray-500">2025年11月1日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">プロトタイプ版スタート</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>観察投稿機能</strong>: 写真から生き物を記録</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>専門家による名前提案</strong>: コミュニティで種同定</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>地図探索</strong>: 周辺の生き物を地図で確認</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>ゲーミフィケーション</strong>: バッジとランク機能</span>
                        </li>
                    </ul>
                </article>

            </div>

            <!-- Newsletter signup -->
            <div class="mt-16 p-8 rounded-2xl bg-white border border-gray-200 shadow-sm text-center">
                <h3 class="text-lg font-bold mb-2">最新情報をお届けします</h3>
                <p class="text-sm text-gray-500 mb-4">新機能の追加時にメールでお知らせします</p>
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
